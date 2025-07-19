import { Message, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../types';
import { OllamaService } from '../services/OllamaService';

// Helper function to split messages that exceed Discord's limit
// @ts-ignore
function splitMessage(text: string, maxLength: number = 1900): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence + ' ';
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence + ' ';
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

export const tanya: Command = {
  name: 'tanya',
  description: 'Ask a question to the AI assistant',
  usage: 'tanya [question]',
  aliases: ['ask', 'ai'],
  cooldown: 10,
  execute: async (message: Message, args?: string[]) => {
    if (!args || args.length === 0) {
      await message.reply('❌ Please provide a question to ask the AI assistant.');
      return;
    }
    const question = args.join(' ');
    try {
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }
                  const ollamaService = new OllamaService();
      const thinkingMessage = await message.reply('🤔 Thinking...');
      let fullResponse = '';
      let lastUpdateTime = Date.now();
      let currentResponseMessage: Message | null = null;
      
      for await (const chunk of ollamaService.askStream(question)) {
        fullResponse += chunk;
        // Always update every chunk, or at least every 50ms
        if ((Date.now() - lastUpdateTime) > 50) {
          // Check if response is getting too long
          if (fullResponse.length > 1900) {
            // Split into chunks and send as new messages
            const chunks = splitMessage(fullResponse);
            if (!currentResponseMessage) {
              // Replace thinking message with first chunk
              await thinkingMessage.edit(chunks[0] || '');
              currentResponseMessage = thinkingMessage;
              // Send remaining chunks as new messages
              for (let i = 1; i < chunks.length; i++) {
                await message.reply(chunks[i] || '');
              }
            } else {
              // Send all chunks as new messages
              for (const chunk of chunks) {
                await message.reply(chunk || '');
              }
            }
            fullResponse = '';
          } else {
            // Replace thinking message or edit current response
            if (!currentResponseMessage) {
              // Replace thinking message with response
              await thinkingMessage.edit(fullResponse);
              currentResponseMessage = thinkingMessage;
            } else {
              // Edit the existing response message
              await currentResponseMessage.edit(fullResponse);
            }
          }
          lastUpdateTime = Date.now();
        }
      }
      
      // Final update - edit existing or create new
      if (fullResponse.trim()) {
        const finalChunks = splitMessage(fullResponse);
        if (!currentResponseMessage) {
          // Replace thinking message with first chunk
          await thinkingMessage.edit(finalChunks[0] || '');
          // Send remaining chunks as new messages
          for (let i = 1; i < finalChunks.length; i++) {
            await message.reply(finalChunks[i] || '');
          }
        } else {
          // Edit first chunk, send rest as new messages
          await currentResponseMessage.edit(finalChunks[0] || '');
          for (let i = 1; i < finalChunks.length; i++) {
            await message.reply(finalChunks[i] || '');
          }
        }
      }
    } catch (error) {
      console.error('Error asking AI:', error);
      await message.reply('❌ Sorry, I encountered an error while processing your question. Please try again later.');
    }
  },
  slashCommand: new SlashCommandBuilder()
    .setName('tanya')
    .setDescription('Ask a question to the AI assistant')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('Your question for the AI')
        .setRequired(true)
    ) as SlashCommandBuilder,
  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const question = interaction.options.getString('question');
    if (!question) {
      await interaction.reply({ content: '❌ Please provide a question to ask the AI assistant.', ephemeral: true });
      return;
    }
    try {
      await interaction.deferReply();
      const ollamaService = new OllamaService();
      let fullResponse = '';
      let lastUpdateTime = Date.now();
      let hasReplied = false;
      
      for await (const chunk of ollamaService.askStream(question)) {
        fullResponse += chunk;
        // Always update every chunk, or at least every 50ms
        if ((Date.now() - lastUpdateTime) > 50) {
          // Check if response is getting too long
          if (fullResponse.length > 1900) {
            // Split into chunks and send as new messages
            const chunks = splitMessage(fullResponse);
            if (!hasReplied) {
              // Edit the deferred reply with first chunk
              await interaction.editReply(chunks[0] || '');
              hasReplied = true;
              // Send remaining chunks as follow-up messages
              for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp({ content: chunks[i] || '' });
              }
            } else {
              // Send all chunks as follow-up messages
              for (const chunk of chunks) {
                await interaction.followUp({ content: chunk || '' });
              }
            }
            fullResponse = '';
          } else {
            // Edit the deferred reply
            await interaction.editReply(fullResponse);
          }
          lastUpdateTime = Date.now();
        }
      }
      
      // Final update - edit existing or create new
      if (fullResponse.trim()) {
        const finalChunks = splitMessage(fullResponse);
        if (!hasReplied) {
          await interaction.editReply(finalChunks[0] || '');
          // Send remaining chunks as follow-up messages
          for (let i = 1; i < finalChunks.length; i++) {
            await interaction.followUp({ content: finalChunks[i] || '' });
          }
        } else {
          // Edit first chunk, send rest as follow-up messages
          await interaction.editReply(finalChunks[0] || '');
          for (let i = 1; i < finalChunks.length; i++) {
            await interaction.followUp({ content: finalChunks[i] || '' });
          }
        }
      }
    } catch (error) {
      console.error('Error asking AI:', error);
      await interaction.editReply('❌ Sorry, I encountered an error while processing your question. Please try again later.');
    }
  },
}; 