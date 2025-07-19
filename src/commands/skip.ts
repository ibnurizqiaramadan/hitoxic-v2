import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const skip: Command = {
  name: 'skip',
  description: 'Skip the current song',
  usage: 'skip',
  aliases: ['s', 'next'],
  cooldown: 3,
  execute: async (message: Message) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.skip(message.guild!);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.skip(interaction.guild!);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 