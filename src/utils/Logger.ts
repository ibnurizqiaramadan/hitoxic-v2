export class Logger {
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[${this.getTimestamp()}] [INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[${this.getTimestamp()}] [WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[${this.getTimestamp()}] [ERROR] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`[${this.getTimestamp()}] [DEBUG] ${message}`, ...args);
    }
  }
} 