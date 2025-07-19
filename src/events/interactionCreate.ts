import { Client, Interaction } from 'discord.js';
import { Event } from '../types';
import { Logger } from '../utils/Logger';

export const interactionCreate: Event = {
  name: 'interactionCreate',
  execute: async (_client: Client, interaction: Interaction) => {
    const logger = new Logger();

    if (!interaction.isChatInputCommand()) {
      return;
    }

    // Note: Slash command handling is done in index.ts via client.on('interactionCreate')
    logger.debug(`Slash command received: ${interaction.commandName}`);
  },
};
