import { Collection, Message } from 'discord.js';
import { Command } from '../types';
import { Logger } from '../utils/Logger';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export class CommandHandler {
  private commands: Collection<string, Command>;
  private logger: Logger;
  private prefix: string;
  private cooldowns: Collection<string, number> = new Collection();
  private performanceMonitor: PerformanceMonitor;

  constructor() {
    this.commands = new Collection();
    this.logger = new Logger();
    this.prefix = process.env['BOT_PREFIX'] || '!';
    this.performanceMonitor = PerformanceMonitor.getInstance();
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

  private checkCooldown(command: Command, userId: string): boolean {
    if (!command.cooldown) return true;

    const key = `${userId}-${command.name}`;
    const now = Date.now();
    const cooldownAmount = (command.cooldown || 3) * 1000;
    const lastUsed = this.cooldowns.get(key);

    if (lastUsed && now - lastUsed < cooldownAmount) {
      return false;
    }

    this.cooldowns.set(key, now);
    return true;
  }

  async handleMessage(message: Message): Promise<void> {
    // Early returns for performance
    if (message.author.bot || !message.content) return;

    this.logger.debug(`Message from ${message.author.tag}: ${message.content}`);

    if (!message.content.startsWith(this.prefix)) return;

    const args = message.content.slice(this.prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = this.commands.get(commandName);
    if (!command) {
      this.logger.debug(`Command not found: ${commandName}`);
      return;
    }

    // Check cooldown
    if (!this.checkCooldown(command, message.author.id)) {
      const remaining = Math.ceil(
        (command.cooldown || 3) -
          (Date.now() -
            (this.cooldowns.get(`${message.author.id}-${command.name}`) || 0)) /
            1000
      );
      await message.reply(
        `⏰ Please wait ${remaining} seconds before using this command again.`
      );
      return;
    }

    try {
      const startTime = Date.now();
      await command.execute(message, args);
      const responseTime = Date.now() - startTime;
      
      this.performanceMonitor.trackCommandExecution();
      this.performanceMonitor.trackResponseTime(responseTime);
    } catch (error) {
      this.logger.error(`Error executing command ${commandName}:`, error);
      this.performanceMonitor.trackError();
      await message.reply('There was an error executing that command!');
    }
  }

  getCommands(): Collection<string, Command> {
    return this.commands;
  }
}
