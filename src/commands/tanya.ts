import {
  Message,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { Command } from '../types';
import { OllamaService } from '../services/OllamaService';

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
      // Send typing indicator
      if ('sendTyping' in message.channel) {
        await message.channel.sendTyping();
      }

      const ollamaService = new OllamaService();
      let currentMessage = await message.reply('🤔 Thinking...');
      let currentMessageContent = ''; // Track content for current message only
      let lastUpdateTime = Date.now();
      const DISCORD_LIMIT = 1950; // Leave some buffer
      const UPDATE_INTERVAL = 100; // Update every 100ms

              for await (const chunk of ollamaService.askStream(question)) {
          currentMessageContent += chunk; // Add to current message content
        
        // Update message periodically to show progress
        if (Date.now() - lastUpdateTime >= UPDATE_INTERVAL) {
          try {
            // Check if current message content is approaching Discord's character limit
            if (currentMessageContent.length >= DISCORD_LIMIT) {
              // Find a good break point (prefer sentence endings)
              let breakPoint = DISCORD_LIMIT;
              const sentenceEnd = currentMessageContent.lastIndexOf('.', DISCORD_LIMIT);
              const questionEnd = currentMessageContent.lastIndexOf('?', DISCORD_LIMIT);
              const exclamationEnd = currentMessageContent.lastIndexOf('!', DISCORD_LIMIT);
              
              breakPoint = Math.max(sentenceEnd, questionEnd, exclamationEnd);
              if (breakPoint === -1 || breakPoint < DISCORD_LIMIT * 0.7) {
                // If no good sentence break, find space
                breakPoint = currentMessageContent.lastIndexOf(' ', DISCORD_LIMIT);
              }
              if (breakPoint === -1) {
                breakPoint = DISCORD_LIMIT;
              }

              // Edit current message with the content up to break point
              const currentMessageFinal = currentMessageContent.substring(0, breakPoint).trim();
              await OllamaService.handleDiscordRateLimit(() => currentMessage.edit(currentMessageFinal));

              // Start new message with remaining content
              const remainingContent = currentMessageContent.substring(breakPoint).trim();
              if (remainingContent) {
                currentMessage = await OllamaService.handleDiscordRateLimit(() => message.reply(remainingContent));
                currentMessageContent = remainingContent; // Reset to only the remaining content
              } else {
                // Start completely fresh message
                currentMessage = await OllamaService.handleDiscordRateLimit(() => message.reply('_Continuing..._'));
                currentMessageContent = '';
              }
            } else {
              // Normal update - edit current message with current content
              await OllamaService.handleDiscordRateLimit(() => 
                currentMessage.edit(currentMessageContent || '🤔 Thinking...')
              );
            }
            
            lastUpdateTime = Date.now();
          } catch (error) {
            // If edit fails (rate limit, etc.), just continue
            console.warn('Failed to update message:', error);
          }
        }
      }

      // Final update
      try {
        if (currentMessageContent.trim()) {
          if (currentMessageContent.length >= DISCORD_LIMIT) {
            // Handle final split if needed
            let breakPoint = DISCORD_LIMIT;
            const sentenceEnd = currentMessageContent.lastIndexOf('.', DISCORD_LIMIT);
            const questionEnd = currentMessageContent.lastIndexOf('?', DISCORD_LIMIT);
            const exclamationEnd = currentMessageContent.lastIndexOf('!', DISCORD_LIMIT);
            
            breakPoint = Math.max(sentenceEnd, questionEnd, exclamationEnd);
            if (breakPoint === -1 || breakPoint < DISCORD_LIMIT * 0.7) {
              breakPoint = currentMessageContent.lastIndexOf(' ', DISCORD_LIMIT);
            }
            if (breakPoint === -1) {
              breakPoint = DISCORD_LIMIT;
            }

            const firstPart = currentMessageContent.substring(0, breakPoint).trim();
            await OllamaService.handleDiscordRateLimit(() => currentMessage.edit(firstPart));

            const remainingText = currentMessageContent.substring(breakPoint).trim();
            if (remainingText) {
              await OllamaService.handleDiscordRateLimit(() => 
                message.reply(remainingText + '\n\n✅ **Done**')
              );
            } else {
              await OllamaService.handleDiscordRateLimit(() => message.reply('✅ **Done**'));
            }
          } else {
            await OllamaService.handleDiscordRateLimit(() => 
              currentMessage.edit(currentMessageContent + '\n\n✅ **Done**')
            );
          }
        } else {
          await OllamaService.handleDiscordRateLimit(() => 
            currentMessage.edit('❌ No response generated. Please try again.')
          );
        }
      } catch (error) {
        console.error('Failed final update:', error);
        await OllamaService.handleDiscordRateLimit(() => 
          message.reply('✅ **Done** (Response completed)')
        );
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
      option
        .setName('question')
        .setDescription('Your question for the AI')
        .setRequired(true)
    ) as SlashCommandBuilder,

  executeSlash: async (interaction: ChatInputCommandInteraction) => {
    const question = interaction.options.getString('question');
    if (!question) {
      await interaction.reply({
        content: '❌ Please provide a question to ask the AI assistant.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.deferReply();
      
            const ollamaService = new OllamaService();
      let currentMessageContent = ''; // Track content for current message only
      let lastUpdateTime = Date.now();
      let lastFollowUpMessage: Message | null = null; // Track the last follow-up message for editing
      const DISCORD_LIMIT = 1950; // Leave some buffer
      const UPDATE_INTERVAL = 100; // Update every 100ms

      for await (const chunk of ollamaService.askStream(question)) {
        currentMessageContent += chunk; // Add to current message content
        
        // Update message periodically to show progress
        if (Date.now() - lastUpdateTime >= UPDATE_INTERVAL) {
          try {
            // Check if current message content is approaching Discord's character limit
            if (currentMessageContent.length >= DISCORD_LIMIT) {
              // Find a good break point (prefer sentence endings)
              let breakPoint = DISCORD_LIMIT;
              const sentenceEnd = currentMessageContent.lastIndexOf('.', DISCORD_LIMIT);
              const questionEnd = currentMessageContent.lastIndexOf('?', DISCORD_LIMIT);
              const exclamationEnd = currentMessageContent.lastIndexOf('!', DISCORD_LIMIT);
              
              breakPoint = Math.max(sentenceEnd, questionEnd, exclamationEnd);
              if (breakPoint === -1 || breakPoint < DISCORD_LIMIT * 0.7) {
                // If no good sentence break, find space
                breakPoint = currentMessageContent.lastIndexOf(' ', DISCORD_LIMIT);
              }
              if (breakPoint === -1) {
                breakPoint = DISCORD_LIMIT;
              }

              // Finalize current message with content up to break point
              const currentMessageFinal = currentMessageContent.substring(0, breakPoint).trim();
              if (lastFollowUpMessage) {
                // Edit the last follow-up message
                const messageToEdit = lastFollowUpMessage;
                await OllamaService.handleDiscordRateLimit(() => 
                  messageToEdit.edit(currentMessageFinal)
                );
              } else {
                // Edit the main reply
                await OllamaService.handleDiscordRateLimit(() => interaction.editReply(currentMessageFinal));
              }

              // Start new follow-up message with remaining content
              const remainingContent = currentMessageContent.substring(breakPoint).trim();
              if (remainingContent) {
                lastFollowUpMessage = await OllamaService.handleDiscordRateLimit(() => 
                  interaction.followUp({ content: remainingContent })
                );
                currentMessageContent = remainingContent; // Reset to only the remaining content
              } else {
                // Start completely fresh follow-up
                lastFollowUpMessage = await OllamaService.handleDiscordRateLimit(() => 
                  interaction.followUp({ content: '_Continuing..._' })
                );
                currentMessageContent = '';
              }
            } else {
              // Normal update - edit current active message with current content
              if (lastFollowUpMessage) {
                // Edit the last follow-up message
                const messageToEdit = lastFollowUpMessage;
                await OllamaService.handleDiscordRateLimit(() => 
                  messageToEdit.edit(currentMessageContent || '_Continuing..._')
                );
              } else {
                // Edit the main reply
                await OllamaService.handleDiscordRateLimit(() => 
                  interaction.editReply(currentMessageContent || '🤔 Thinking...')
                );
              }
            }
            
            lastUpdateTime = Date.now();
          } catch (error) {
            // If edit fails (rate limit, etc.), just continue
            console.warn('Failed to update interaction:', error);
          }
        }
      }

            // Final update
      try {
        if (currentMessageContent.trim()) {
          if (currentMessageContent.length >= DISCORD_LIMIT) {
            // Handle final split if needed
            let breakPoint = DISCORD_LIMIT;
            const sentenceEnd = currentMessageContent.lastIndexOf('.', DISCORD_LIMIT);
            const questionEnd = currentMessageContent.lastIndexOf('?', DISCORD_LIMIT);
            const exclamationEnd = currentMessageContent.lastIndexOf('!', DISCORD_LIMIT);
            
            breakPoint = Math.max(sentenceEnd, questionEnd, exclamationEnd);
            if (breakPoint === -1 || breakPoint < DISCORD_LIMIT * 0.7) {
              breakPoint = currentMessageContent.lastIndexOf(' ', DISCORD_LIMIT);
            }
            if (breakPoint === -1) {
              breakPoint = DISCORD_LIMIT;
            }

            const firstPart = currentMessageContent.substring(0, breakPoint).trim();
            if (lastFollowUpMessage) {
              const messageToEdit = lastFollowUpMessage;
              await OllamaService.handleDiscordRateLimit(() => 
                messageToEdit.edit(firstPart)
              );
            } else {
              await OllamaService.handleDiscordRateLimit(() => interaction.editReply(firstPart));
            }

            const remainingText = currentMessageContent.substring(breakPoint).trim();
            if (remainingText) {
              await OllamaService.handleDiscordRateLimit(() => 
                interaction.followUp({ content: remainingText + '\n\n✅ **Done**' })
              );
            } else {
              await OllamaService.handleDiscordRateLimit(() => 
                interaction.followUp({ content: '✅ **Done**' })
              );
            }
          } else {
            if (lastFollowUpMessage) {
              const messageToEdit = lastFollowUpMessage;
              await OllamaService.handleDiscordRateLimit(() => 
                messageToEdit.edit(currentMessageContent + '\n\n✅ **Done**')
              );
            } else {
              await OllamaService.handleDiscordRateLimit(() => 
                interaction.editReply(currentMessageContent + '\n\n✅ **Done**')
              );
            }
          }
      } else {
        await OllamaService.handleDiscordRateLimit(() => 
          interaction.editReply('❌ No response generated. Please try again.')
        );
      }
    } catch (error) {
      console.error('Failed final update:', error);
      await OllamaService.handleDiscordRateLimit(() => 
        interaction.followUp({ content: '✅ **Done** (Response completed)' })
      );
    }

    } catch (error) {
      console.error('Error asking AI:', error);
      await interaction.editReply('❌ Sorry, I encountered an error while processing your question. Please try again later.');
    }
  },
};

