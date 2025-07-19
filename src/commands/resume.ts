import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const resume: Command = {
  name: 'resume',
  description: 'Resume the current song',
  usage: 'resume',
  aliases: ['r', 'unpause'],
  cooldown: 3,
  execute: async (message: Message) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.resume(message.guild!);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the current song') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.resume(interaction.guild!);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 