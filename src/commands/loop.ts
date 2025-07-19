import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const loop: Command = {
  name: 'loop',
  description: 'Toggle loop mode for the current song',
  usage: 'loop',
  aliases: ['repeat'],
  cooldown: 3,
  execute: async (message: Message) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.loop(message.guild!);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle loop mode for the current song') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.loop(interaction.guild!);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 