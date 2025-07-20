import {
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '../types';

export const help: Command = {
  name: 'help',
  description: 'Show all available commands',
  usage: 'help [command]',
  aliases: ['h', 'commands'],
  cooldown: 3,
  execute: async (message: Message, args?: string[]) => {
    const prefix = process.env['BOT_PREFIX'] || '!';

    if (!args || args.length === 0) {
      // Show all commands
      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Commands')
        .setDescription(
          `Use \`${prefix}help [command]\` for more info about a specific command.`
        )
        .setColor('#0099ff')
        .setTimestamp();

      embed.addFields({
        name: 'Available Commands',
        value:
          '`ping` - Ping the bot to check latency\n`help` - Show all available commands\n`tanya` - Ask a question to the AI assistant\n`invite` - Get the bot invite link\n`stats` - Show bot performance statistics\n\n**🎵 Music Commands:**\n`play` - Play a song from YouTube\n`skip` - Skip the current song\n`stop` - Stop music and clear queue\n`pause` - Pause the current song\n`resume` - Resume the current song\n`queue` - Show the music queue\n`volume` - Set music volume\n`loop` - Toggle loop mode',
        inline: false,
      });

      await message.reply({ embeds: [embed] });
    } else {
      // Show specific command help
      const commandName = args[0]?.toLowerCase() || '';

      if (commandName === 'ping') {
        const embed = new EmbedBuilder()
          .setTitle('Command: ping')
          .setDescription('Ping the bot to check latency')
          .setColor('#0099ff')
          .addFields(
            { name: 'Usage', value: `\`${prefix}ping\``, inline: true },
            { name: 'Cooldown', value: '5s', inline: true }
          )
          .setTimestamp();

        embed.addFields({
          name: 'Aliases',
          value: '`p`',
          inline: false,
        });

        await message.reply({ embeds: [embed] });
      } else {
        await message.reply(`❌ Command \`${commandName}\` not found.`);
      }
    }
  },
  slashCommand: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Specific command to get help for')
        .setRequired(false)
    ) as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const commandName = interaction.options.getString('command');

    if (!commandName) {
      // Show all commands
      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Commands')
        .setDescription(
          'Use `/help [command]` for more info about a specific command.'
        )
        .setColor('#0099ff')
        .setTimestamp();

      embed.addFields({
        name: 'Available Commands',
        value:
          '`ping` - Ping the bot to check latency\n`help` - Show all available commands\n`tanya` - Ask a question to the AI assistant\n`invite` - Get the bot invite link\n`stats` - Show bot performance statistics\n\n**🎵 Music Commands:**\n`play` - Play a song from YouTube\n`skip` - Skip the Skip the current song\n`stop` - Stop music and clear queue\n`pause` - Pause the current song\n`resume` - Resume the current song\n`queue` - Show the music queue\n`volume` - Set music volume\n`loop` - Toggle loop mode',
        inline: false,
      });

      await interaction.reply({ embeds: [embed] });
    } else {
      // Show specific command help
      if (commandName === 'ping') {
        const embed = new EmbedBuilder()
          .setTitle('Command: ping')
          .setDescription('Ping the bot to check latency')
          .setColor('#0099ff')
          .addFields(
            { name: 'Usage', value: '`/ping`', inline: true },
            { name: 'Cooldown', value: '5s', inline: true }
          )
          .setTimestamp();

        embed.addFields({
          name: 'Aliases',
          value: '`p`',
          inline: false,
        });

        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({
          content: `❌ Command \`${commandName}\` not found.`,
          ephemeral: true,
        });
      }
    }
  },
};
