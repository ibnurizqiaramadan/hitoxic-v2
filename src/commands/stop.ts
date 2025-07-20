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
    if (!message.guild) {
      await message.reply('❌ This command can only be used in a server!');
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.stop(message.guild);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the music and clear the queue') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ This command can only be used in a server!', ephemeral: true });
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.stop(interaction.guild);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 