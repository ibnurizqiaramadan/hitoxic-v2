import { Message, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';

export const ping: Command = {
  name: 'ping',
  description: 'Ping the bot to check latency',
  usage: 'ping',
  aliases: ['p'],
  cooldown: 5,
  execute: async (message: Message) => {
    const sent = await message.reply('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;

    await sent.edit(
      `🏓 Pong! Latency is ${latency}ms. API Latency is ${Math.round(message.client.ws.ping)}ms`
    );
  },
  slashCommand: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Ping the bot to check latency'),
  executeSlash: async interaction => {
    const sent = await interaction.reply({
      content: 'Pinging...',
      fetchReply: true,
    });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(
      `🏓 Pong! Latency is ${latency}ms. API Latency is ${Math.round(interaction.client.ws.ping)}ms`
    );
  },
};
