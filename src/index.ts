import { Client, GatewayIntentBits, ActivityType, PresenceStatusData, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { CommandHandler } from './handlers/CommandHandler';
import { EventHandler } from './handlers/EventHandler';
import { Logger } from './utils/Logger';

// Load environment variables
config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const logger = new Logger();

// Initialize handlers
const commandHandler = new CommandHandler(client);
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
async function registerSlashCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(process.env['DISCORD_TOKEN']!);
    
    // Get slash commands from commands
    const slashCommands = commands
      .filter(cmd => cmd.slashCommand)
      .map(cmd => cmd.slashCommand!.toJSON());
    
    if (slashCommands.length === 0) {
      logger.info('No slash commands to register');
      return;
    }
    
    logger.info(`Started refreshing ${slashCommands.length} application (/) commands.`);
    
    // Register commands globally
    await rest.put(
      Routes.applicationCommands(process.env['CLIENT_ID']!),
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
  client.user?.setActivity(process.env['BOT_ACTIVITY'] || '!help', {
    type: ActivityType.Playing,
  });
  
  // Set bot status
  client.user?.setStatus(process.env['BOT_STATUS'] as PresenceStatusData || 'online');
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

// Login to Discord
client.login(process.env['DISCORD_TOKEN']); 