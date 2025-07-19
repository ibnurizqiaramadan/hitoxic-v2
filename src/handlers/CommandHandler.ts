import { Client, Collection, Message } from 'discord.js';
import { Command } from '../types';
import { Logger } from '../utils/Logger';

export class CommandHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore
  private _client: Client;
  private commands: Collection<string, Command>;
  private logger: Logger;
  private prefix: string;

  constructor(client: Client) {
    this._client = client;
    this.commands = new Collection();
    this.logger = new Logger();
    this.prefix = process.env['BOT_PREFIX'] || '!';
  }

  registerCommand(command: Command): void {
    this.commands.set(command.name, command);
    if (command.aliases) {
      command.aliases.forEach(alias => {
        this.commands.set(alias, command);
      });
    }
    this.logger.info(`Registered command: ${command.name}`);
  }

  async handleMessage(message: Message): Promise<void> {

    this.logger.info(`Message received: "${message.content}"`);

    if (message.author.bot) {
      this.logger.info('Message from bot, skipping');
      return;
    }

    this.logger.info(`Checking if message starts with prefix "${this.prefix}"`);
    if (!message.content.startsWith(this.prefix)) {
      this.logger.info(`Message doesn't start with prefix "${this.prefix}"`);
      return;
    }

    this.logger.info('Message starts with prefix, parsing command...');
    const args = message.content.slice(this.prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase()?.trim();

    this.logger.info(`Prefix: "${this.prefix}", Command name: "${commandName}", Available commands: [${Array.from(this.commands.keys()).join(', ')}]`);

    if (!commandName) {
      this.logger.info('No command name found');
      return;
    }

    const command = this.commands.get(commandName);

    if (!command) {
      this.logger.warn(`Command not found: ${commandName}`);
      return;
    }

    try {
      await command.execute(message, args);
    } catch (error) {
      this.logger.error(`Error executing command ${commandName}:`, error);
      await message.reply('There was an error executing that command!');
    }
  }

  getCommands(): Collection<string, Command> {
    return this.commands;
  }
} 