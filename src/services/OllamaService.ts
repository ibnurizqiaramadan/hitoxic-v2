import { Logger } from '../utils/Logger';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface QueuedRequest {
  prompt: string;
  resolve: (generator: AsyncGenerator<string>) => void;
  reject: (error: Error) => void;
}

interface CacheEntry {
  response: string;
  timestamp: number;
}

export class OllamaService {
  private baseUrl: string;
  private model: string;
  private logger: Logger;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 100;
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    this.baseUrl = process.env['OLLAMA_URL'] || 'http://localhost:11434';
    this.model = process.env['OLLAMA_MODEL'] || 'gemma3:4b-it-qat';
    this.logger = new Logger();
    this.performanceMonitor = PerformanceMonitor.getInstance();
  }

  private getCacheKey(prompt: string): string {
    return `${this.model}:${prompt.toLowerCase().trim()}`;
  }

  private getFromCache(prompt: string): string | null {
    const key = this.getCacheKey(prompt);
    const entry = this.cache.get(key);

    if (entry && Date.now() - entry.timestamp < this.CACHE_TTL) {
      this.logger.debug('Cache hit for prompt');
      this.performanceMonitor.trackCacheHit();
      return entry.response;
    }

    if (entry) {
      this.cache.delete(key);
    }

    this.performanceMonitor.trackCacheMiss();
    return null;
  }

  private setCache(prompt: string, response: string): void {
    const key = this.getCacheKey(prompt);

    // Clean up old entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.logger.info(
      `Processing queue with ${this.requestQueue.length} requests`
    );

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        this.logger.debug('Processing Ollama request...');
        const generator = await this.makeRequest(request.prompt);
        request.resolve(generator);

        // Add delay between requests to prevent overload
        if (this.requestQueue.length > 0) {
          this.logger.debug('Waiting 2 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        this.logger.error('Error processing Ollama request:', error);
        request.reject(error as Error);

        // Add longer delay on error
        if (this.requestQueue.length > 0) {
          this.logger.debug('Waiting 5 seconds after error...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    this.isProcessing = false;
    this.logger.debug('Queue processing completed');
  }

  private async makeRequest(
    prompt: string,
    retryCount = 0
  ): Promise<AsyncGenerator<string>> {
    const maxRetries = 3;
    const timeout = 30000; // 30 seconds timeout

    try {
      const requestBody: OllamaRequest = {
        model: this.model,
        prompt: `You are a helpful Discord bot assistant.\n\n${prompt}`,
        stream: true,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Ollama API error: ${response.status} ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new Error('No response body from Ollama');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const streamResponse = async function* (): AsyncGenerator<string> {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line) as OllamaResponse;
                if (data.response) {
                  yield data.response;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      };

      return streamResponse();
    } catch (error) {
      if (retryCount < maxRetries) {
        this.logger.warn(
          `Ollama request failed, retrying... (${retryCount + 1}/${maxRetries})`
        );
        await new Promise(resolve =>
          setTimeout(resolve, 2000 * (retryCount + 1))
        ); // Exponential backoff
        return this.makeRequest(prompt, retryCount + 1);
      }
      throw error;
    }
  }

  async *askStream(prompt: string): AsyncGenerator<string> {
    // Check cache first
    const cachedResponse = this.getFromCache(prompt);
    if (cachedResponse) {
      // Simulate streaming for cached responses to maintain consistent UX
      const words = cachedResponse.split(' ');
      for (let i = 0; i < words.length; i++) {
        const chunk = words.slice(0, i + 1).join(' ');
        if (i < words.length - 1) {
          yield chunk;
          // Small delay to simulate natural typing
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          yield chunk; // Final chunk without delay
        }
      }
      return;
    }

    const generator = await new Promise<AsyncGenerator<string>>(
      (resolve, reject) => {
        this.requestQueue.push({ prompt, resolve, reject });
        this.processQueue();
      }
    );

    let fullResponse = '';
    for await (const chunk of generator) {
      fullResponse += chunk;
      yield chunk;
    }

    // Cache the complete response
    this.setCache(prompt, fullResponse);
  }

  async ask(prompt: string): Promise<string> {
    // Check cache first
    const cachedResponse = this.getFromCache(prompt);
    if (cachedResponse) {
      return cachedResponse;
    }

    let fullResponse = '';
    for await (const chunk of this.askStream(prompt)) {
      fullResponse += chunk;
    }

    // Cache the response
    this.setCache(prompt, fullResponse);
    return fullResponse;
  }

  // Method to clear cache (useful for testing or memory management)
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  // Method to get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Could be implemented with hit/miss counters
    };
  }

  // Helper method for handling Discord API rate limits
  static async handleDiscordRateLimit<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        const errorObj = error as { code?: number; status?: number; message?: string };
        const isRateLimit = errorObj?.code === 50013 || 
                          errorObj?.status === 429 || 
                          errorObj?.message?.includes('rate limit') ||
                          errorObj?.message?.includes('Too Many Requests');
        
        if (isRateLimit && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          console.warn(`Discord rate limit hit, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Max retries exceeded for Discord API operation');
  }
}
