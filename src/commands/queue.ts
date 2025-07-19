import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const queue: Command = {
  name: 'queue',
  description: 'Show the music queue',
  usage: 'queue',
  aliases: ['q', 'list'],
  cooldown: 5,
  execute: async (message: Message) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.queue(message.guild!);
    
    if (result.success) {
      if (typeof result.message === 'string') {
        await message.reply(result.message);
      } else {
        await message.reply({ embeds: [result.message] });
      }
    } else {
      await message.reply(result.message as string);
    }
  },
  slashCommand: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the music queue') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.queue(interaction.guild!);
    
    if (result.success) {
      if (typeof result.message === 'string') {
        await interaction.reply(result.message);
      } else {
        await interaction.reply({ embeds: [result.message] });
      }
    } else {
      await interaction.reply({ content: result.message as string, ephemeral: true });
    }
  },
}; 