import {
  Message,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../types';

export const invite: Command = {
  name: 'invite',
  description: 'Get the bot invite link',
  usage: 'invite',
  aliases: ['inv', 'link'],
  cooldown: 5,
  execute: async (message: Message) => {
    try {
      const clientId = process.env['CLIENT_ID'];
      if (!clientId) {
        await message.reply(
          '❌ Bot invite link is not configured. Please contact the bot administrator.'
        );
        return;
      }

      const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2147483648&scope=bot%20applications.commands`;

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🤖 Bot Invite Link')
        .setDescription('Click the link below to invite me to your server!')
        .addFields({
          name: '🔗 Invite Link',
          value: `[Click here to invite bot](${inviteLink})`,
          inline: false,
        })
        .addFields({
          name: '📋 Permissions',
          value:
            '• Send Messages\n• Read Message History\n• Use Slash Commands\n• Embed Links\n• Attach Files',
          inline: true,
        })
        .addFields({
          name: '⚙️ Features',
          value:
            '• AI Chat Commands\n• Slash Commands\n• Message Commands\n• Help System',
          inline: true,
        })
        .setFooter({ text: 'Thanks for using our bot!' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error generating invite link:', error);
      await message.reply(
        '❌ Sorry, I encountered an error while generating the invite link. Please try again later.'
      );
    }
  },
  slashCommand: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the bot invite link') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    try {
      const clientId = process.env['CLIENT_ID'];
      if (!clientId) {
        await interaction.reply({
          content:
            '❌ Bot invite link is not configured. Please contact the bot administrator.',
          ephemeral: true,
        });
        return;
      }

      const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=2147483648&scope=bot%20applications.commands`;

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🤖 Bot Invite Link')
        .setDescription('Click the link below to invite me to your server!')
        .addFields({
          name: '🔗 Invite Link',
          value: `[Click here to invite bot](${inviteLink})`,
          inline: false,
        })
        .addFields({
          name: '📋 Permissions',
          value:
            '• Send Messages\n• Read Message History\n• Use Slash Commands\n• Embed Links\n• Attach Files',
          inline: true,
        })
        .addFields({
          name: '⚙️ Features',
          value:
            '• AI Chat Commands\n• Slash Commands\n• Message Commands\n• Help System',
          inline: true,
        })
        .setFooter({ text: 'Thanks for using our bot!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error generating invite link:', error);
      await interaction.reply({
        content:
          '❌ Sorry, I encountered an error while generating the invite link. Please try again later.',
        ephemeral: true,
      });
    }
  },
};
