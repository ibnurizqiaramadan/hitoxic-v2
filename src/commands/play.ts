import { Message, SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, GuildMember } from 'discord.js';
import { Command } from '../types';
import { MusicService } from '../services/MusicService';

export const play: Command = {
  name: 'play',
  description: 'Play a song from YouTube',
  usage: 'play <song name or URL>',
  aliases: ['p', 'music'],
  cooldown: 5,
  execute: async (message: Message, args?: string[]) => {
    if (!args || args.length === 0) {
      await message.reply('❌ Please provide a song name or URL!');
      return;
    }

    if (!message.guild) {
      await message.reply('❌ This command can only be used in a server!');
      return;
    }

    if (!message.member) {
      await message.reply('❌ Could not find your member information!');
      return;
    }

    const query = args.join(' ');
    const musicService = MusicService.getInstance();
    
    const result = await musicService.play(
      message.guild,
      message.member,
      query,
      message.channel as TextChannel
    );

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
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Song name or YouTube URL')
        .setRequired(true)
    ) as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const query = interaction.options.getString('query', true);
    
    // Defer reply to prevent timeout
    await interaction.deferReply();

    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server!');
      return;
    }

    if (!interaction.member) {
      await interaction.editReply('❌ Could not find your member information!');
      return;
    }
    
    const musicService = MusicService.getInstance();
    
    const result = await musicService.play(
      interaction.guild,
      interaction.member as GuildMember,
      query,
      interaction.channel as TextChannel
    );

    if (result.success) {
      if (typeof result.message === 'string') {
        await interaction.editReply(result.message);
      } else {
        await interaction.editReply({ embeds: [result.message] });
      }
    } else {
      await interaction.editReply({ content: result.message as string });
    }
  },
}; 