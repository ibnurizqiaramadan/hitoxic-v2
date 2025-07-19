import { Logger } from '../utils/Logger';

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

export class OllamaService {
  private baseUrl: string;
  private model: string;
  private logger: Logger;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;

  constructor() {
    this.baseUrl = process.env['OLLAMA_URL'] || 'http://localhost:11434';
    this.model = process.env['OLLAMA_MODEL'] || 'gemma3:4b-it-qat';
    this.logger = new Logger();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.logger.info(`Processing queue with ${this.requestQueue.length} requests`);

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        this.logger.info('Processing Ollama request...');
        const generator = await this.makeRequest(request.prompt);
        request.resolve(generator);
        
        // Add delay between requests to prevent overload
        if (this.requestQueue.length > 0) {
          this.logger.info('Waiting 2 seconds before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        this.logger.error('Error processing Ollama request:', error);
        request.reject(error as Error);
        
        // Add longer delay on error
        if (this.requestQueue.length > 0) {
          this.logger.info('Waiting 5 seconds after error...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    this.isProcessing = false;
    this.logger.info('Queue processing completed');
  }

  private async makeRequest(prompt: string, retryCount = 0): Promise<AsyncGenerator<string>> {
    const maxRetries = 3;
    const timeout = 30000; // 30 seconds timeout

    try {
      const requestBody: OllamaRequest = {
        model: this.model,
        prompt: `You are a helpful Discord bot assistant. Keep all responses under 2000 characters to fit Discord message limits. Be concise but helpful.\n\n${prompt}`,
        stream: true
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
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
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
        this.logger.warn(`Ollama request failed, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Exponential backoff
        return this.makeRequest(prompt, retryCount + 1);
      }
      throw error;
    }
  }

  async *askStream(prompt: string): AsyncGenerator<string> {
    const generator = await new Promise<AsyncGenerator<string>>((resolve, reject) => {
      this.requestQueue.push({ prompt, resolve, reject });
      this.processQueue();
    });
    
    yield* generator;
  }

  async ask(prompt: string): Promise<string> {
    let fullResponse = '';
    for await (const chunk of this.askStream(prompt)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
} 