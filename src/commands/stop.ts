import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const stop: Command = {
  name: 'stop',
  description: 'Stop the music and clear the queue',
  usage: 'stop',
  aliases: ['leave', 'disconnect'],
  cooldown: 3,
  execute: async (message: Message) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.stop(message.guild!);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.stop(interaction.guild!);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 