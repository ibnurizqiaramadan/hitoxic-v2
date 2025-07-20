import { Client, GatewayIntentBits, ActivityType, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { CommandHandler } from './handlers/CommandHandler';
import { EventHandler } from './handlers/EventHandler';
import { Logger } from './utils/Logger';
import { Config } from './utils/Config';
import { MusicService } from './services/MusicService';

// Load environment variables
config();

// Initialize configuration
const botConfig = Config.getInstance();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const logger = new Logger();

// Initialize handlers
const commandHandler = new CommandHandler();
const eventHandler = new EventHandler(client);

// Register commands
import commands from './commands';  
commands.forEach(command => {
  commandHandler.registerCommand(command);
});

// Register events
import events from './events';
events.forEach(event => {
  eventHandler.registerEvent(event);
});

// Function to register slash commands
async function registerSlashCommands(): Promise<void> {
  try {
    const rest = new REST({ version: '10' }).setToken(botConfig.get('token'));
    
    // Get slash commands from commands
    const slashCommands = commands
      .filter(cmd => cmd.slashCommand)
      .map(cmd => cmd.slashCommand?.toJSON());
    
    if (slashCommands.length === 0) {
      logger.info('No slash commands to register');
      return;
    }
    
    logger.info(`Started refreshing ${slashCommands.length} application (/) commands.`);
    
    // Register commands globally
    await rest.put(
      Routes.applicationCommands(botConfig.get('clientId')),
      { body: slashCommands },
    );
    
    logger.info(`Successfully reloaded ${slashCommands.length} application (/) commands.`);
  } catch (error) {
    logger.error('Error registering slash commands:', error);
  }
}

// Bot ready event
client.once('ready', async () => {
  logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
  
  // Register slash commands
  await registerSlashCommands();
  
  // Set bot activity
  client.user?.setActivity(botConfig.get('activity'), {
    type: ActivityType.Playing,
  });
  
  // Set bot status
  client.user?.setStatus(botConfig.get('status'));
});

// Handle messages
client.on('messageCreate', (message) => {
  commandHandler.handleMessage(message);
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const command = commands.find(cmd => cmd.name === interaction.commandName);
  if (!command || !command.executeSlash) {
    logger.warn(`Slash command not found: ${interaction.commandName}`);
    return;
  }
  
  try {
    await command.executeSlash(interaction);
  } catch (error) {
    logger.error(`Error executing slash command ${interaction.commandName}:`, error);
    await interaction.reply({ content: 'There was an error executing that command!', ephemeral: true });
  }
});

// Voice state update handling for empty channel detection
client.on('voiceStateUpdate', async (oldState, newState) => {
  const musicService = MusicService.getInstance();
  await musicService.handleVoiceStateUpdate(oldState, newState);
});

// Error handling
client.on('error', (error) => {
  logger.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Login to Discord
client.login(botConfig.get('token')); 