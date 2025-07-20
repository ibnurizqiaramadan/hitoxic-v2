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
    if (!message.guild) {
      await message.reply('❌ This command can only be used in a server!');
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.pause(message.guild);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ This command can only be used in a server!', ephemeral: true });
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.pause(interaction.guild);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 