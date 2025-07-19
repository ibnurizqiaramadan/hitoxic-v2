import { Logger } from './Logger';

interface PerformanceMetrics {
  commandExecutions: number;
  averageResponseTime: number;
  errors: number;
  cacheHits: number;
  cacheMisses: number;
  uptime: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private logger: Logger;
  private startTime: number;
  private metrics: PerformanceMetrics;
  private responseTimes: number[] = [];

  private constructor() {
    this.logger = new Logger();
    this.startTime = Date.now();
    this.metrics = {
      commandExecutions: 0,
      averageResponseTime: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      uptime: 0,
    };
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public trackCommandExecution(): void {
    this.metrics.commandExecutions++;
  }

  public trackResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime);

    // Keep only last 100 response times to prevent memory leaks
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }

    this.metrics.averageResponseTime =
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
  }

  public trackError(): void {
    this.metrics.errors++;
  }

  public trackCacheHit(): void {
    this.metrics.cacheHits++;
  }

  public trackCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  public getMetrics(): PerformanceMetrics {
    this.metrics.uptime = Date.now() - this.startTime;
    return { ...this.metrics };
  }

  public logMetrics(): void {
    const metrics = this.getMetrics();
    const cacheHitRate =
      metrics.cacheHits + metrics.cacheMisses > 0
        ? (
            (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) *
            100
          ).toFixed(2)
        : '0.00';

    this.logger.info('Performance Metrics:', {
      uptime: `${Math.floor(metrics.uptime / 1000 / 60)}m ${Math.floor((metrics.uptime / 1000) % 60)}s`,
      commandExecutions: metrics.commandExecutions,
      averageResponseTime: `${metrics.averageResponseTime.toFixed(2)}ms`,
      errors: metrics.errors,
      cacheHitRate: `${cacheHitRate}%`,
      cacheHits: metrics.cacheHits,
      cacheMisses: metrics.cacheMisses,
    });
  }

  public reset(): void {
    this.startTime = Date.now();
    this.metrics = {
      commandExecutions: 0,
      averageResponseTime: 0,
      errors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      uptime: 0,
    };
    this.responseTimes = [];
    this.logger.info('Performance metrics reset');
  }
}
