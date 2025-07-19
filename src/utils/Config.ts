export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  prefix: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  activity: string;
  environment: 'development' | 'production';
  ollama: {
    url: string;
    model: string;
  };
}

export class Config {
  private static instance: Config;
  private config: BotConfig;

  private constructor() {
    const guildId = process.env['GUILD_ID'];

    this.config = {
      token: process.env['DISCORD_TOKEN'] || '',
      clientId: process.env['CLIENT_ID'] || '',
      prefix: process.env['BOT_PREFIX'] || '!',
      status:
        (process.env['BOT_STATUS'] as
          | 'online'
          | 'idle'
          | 'dnd'
          | 'invisible') || 'online',
      activity: process.env['BOT_ACTIVITY'] || '!help',
      environment:
        (process.env['NODE_ENV'] as 'development' | 'production') ||
        'development',
      ollama: {
        url: process.env['OLLAMA_URL'] || 'http://localhost:11434',
        model: process.env['OLLAMA_MODEL'] || 'gemma3:4b-it-qat',
      },
      ...(guildId && { guildId }),
    };

    this.validateConfig();
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private validateConfig(): void {
    const requiredFields = ['token', 'clientId'] as const;

    for (const field of requiredFields) {
      if (!this.config[field]) {
        throw new Error(`Missing required configuration: ${field}`);
      }
    }
  }

  public get<K extends keyof BotConfig>(key: K): BotConfig[K] {
    return this.config[key];
  }

  public getAll(): BotConfig {
    return { ...this.config };
  }

  public isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  public isProduction(): boolean {
    return this.config.environment === 'production';
  }
}
