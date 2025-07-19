import { Message, SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../types';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export const stats: Command = {
  name: 'stats',
  description: 'Show bot performance statistics',
  usage: 'stats',
  aliases: ['statistics', 'metrics', 'performance'],
  cooldown: 30,
  execute: async (message: Message) => {
    try {
      const performanceMonitor = PerformanceMonitor.getInstance();
      const metrics = performanceMonitor.getMetrics();
      
      const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0 
        ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2)
        : '0.00';

      const uptimeMinutes = Math.floor(metrics.uptime / 1000 / 60);
      const uptimeSeconds = Math.floor((metrics.uptime / 1000) % 60);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📊 Bot Performance Statistics')
        .setDescription('Real-time performance metrics for the bot')
        .addFields(
          {
            name: '⏱️ Uptime',
            value: `${uptimeMinutes}m ${uptimeSeconds}s`,
            inline: true,
          },
          {
            name: '🚀 Commands Executed',
            value: metrics.commandExecutions.toString(),
            inline: true,
          },
          {
            name: '⚡ Avg Response Time',
            value: `${metrics.averageResponseTime.toFixed(2)}ms`,
            inline: true,
          },
          {
            name: '❌ Errors',
            value: metrics.errors.toString(),
            inline: true,
          },
          {
            name: '💾 Cache Hit Rate',
            value: `${cacheHitRate}%`,
            inline: true,
          },
          {
            name: '📈 Cache Hits',
            value: `${metrics.cacheHits} hits / ${metrics.cacheMisses} misses`,
            inline: true,
          }
        )
        .setFooter({ text: 'Performance metrics are reset on bot restart' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error getting stats:', error);
      await message.reply('❌ Sorry, I encountered an error while getting statistics.');
    }
  },
  slashCommand: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show bot performance statistics') as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    try {
      const performanceMonitor = PerformanceMonitor.getInstance();
      const metrics = performanceMonitor.getMetrics();
      
      const cacheHitRate = metrics.cacheHits + metrics.cacheMisses > 0 
        ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100).toFixed(2)
        : '0.00';

      const uptimeMinutes = Math.floor(metrics.uptime / 1000 / 60);
      const uptimeSeconds = Math.floor((metrics.uptime / 1000) % 60);

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('📊 Bot Performance Statistics')
        .setDescription('Real-time performance metrics for the bot')
        .addFields(
          {
            name: '⏱️ Uptime',
            value: `${uptimeMinutes}m ${uptimeSeconds}s`,
            inline: true,
          },
          {
            name: '🚀 Commands Executed',
            value: metrics.commandExecutions.toString(),
            inline: true,
          },
          {
            name: '⚡ Avg Response Time',
            value: `${metrics.averageResponseTime.toFixed(2)}ms`,
            inline: true,
          },
          {
            name: '❌ Errors',
            value: metrics.errors.toString(),
            inline: true,
          },
          {
            name: '💾 Cache Hit Rate',
            value: `${cacheHitRate}%`,
            inline: true,
          },
          {
            name: '📈 Cache Hits',
            value: `${metrics.cacheHits} hits / ${metrics.cacheMisses} misses`,
            inline: true,
          }
        )
        .setFooter({ text: 'Performance metrics are reset on bot restart' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Error getting stats:', error);
      await interaction.reply({ 
        content: '❌ Sorry, I encountered an error while getting statistics.',
        ephemeral: true 
      });
    }
  },
}; 