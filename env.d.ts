declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
    DISCORD_TOKEN: string;
    CLIENT_ID: string;
    GUILD_ID: string;
    BOT_PREFIX: string;
    BOT_STATUS: string;
    BOT_ACTIVITY: string;
  }
}
