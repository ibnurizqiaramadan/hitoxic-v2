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
    if (!message.guild) {
      await message.reply('❌ This command can only be used in a server!');
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.skip(message.guild);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ This command can only be used in a server!', ephemeral: true });
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.skip(interaction.guild);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 