import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const pause: Command = {
  name: 'pause',
  description: 'Pause the current song',
  usage: 'pause',
  aliases: ['p'],
  cooldown: 3,
  execute: async (message: Message) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.pause(message.guild!);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const musicService = MusicService.getInstance();
    const result = await musicService.pause(interaction.guild!);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 