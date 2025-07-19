import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const volume: Command = {
  name: 'volume',
  description: 'Set the music volume',
  usage: 'volume <0-100>',
  aliases: ['vol', 'v'],
  cooldown: 3,
  execute: async (message: Message, args?: string[]) => {
    if (!args || args.length === 0) {
      await message.reply('❌ Please provide a volume level (0-100)!');
      return;
    }

    const volume = parseInt(args[0] || '0');
    if (isNaN(volume)) {
      await message.reply('❌ Please provide a valid number for volume!');
      return;
    }

    const musicService = MusicService.getInstance();
    const result = await musicService.volume(message.guild!, volume);
    
    await message.reply(result.message);
  },
  slashCommand: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the music volume')
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('Volume level (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ) as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const volume = interaction.options.getInteger('level', true);
    const musicService = MusicService.getInstance();
    const result = await musicService.volume(interaction.guild!, volume);
    
    await interaction.reply({ content: result.message, ephemeral: true });
  },
}; 