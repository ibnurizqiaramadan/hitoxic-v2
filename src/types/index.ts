import {
  Message,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';

export interface Command {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  cooldown?: number;
  permissions?: string[];
  execute: (message: Message, args?: string[]) => Promise<void>;
  slashCommand?: SlashCommandBuilder;
  executeSlash?: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export interface Event {
  name: string;
  once?: boolean;
  execute: (...args: unknown[]) => Promise<void>;
}

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string;
  prefix: string;
  status: string;
  activity: string;
}
