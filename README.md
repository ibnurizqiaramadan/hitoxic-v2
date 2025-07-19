# Discord.js TypeScript Bot

A modern Discord.js bot built with TypeScript, featuring a modular architecture with command and event handlers.

## Features

- 🚀 **TypeScript** - Full type safety and modern JavaScript features
- 📦 **Modular Architecture** - Organized command and event handlers
- 🎯 **Slash Commands** - Support for Discord's slash command system
- 🔧 **Development Tools** - ESLint, Prettier, and Jest for code quality
- 📝 **Logging** - Comprehensive logging system
- 🧪 **Testing** - Jest configuration for unit testing

## Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- A Discord bot token

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your Discord bot credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   BOT_PREFIX=!
   BOT_STATUS=online
   BOT_ACTIVITY=!help
   NODE_ENV=development
   ```

## Getting Your Discord Bot Token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to the "Bot" section
4. Create a bot and copy the token
5. Enable the necessary intents (Message Content Intent, Server Members Intent)
6. Use the OAuth2 URL generator to invite the bot to your server

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Watch Mode (for development)
```bash
npm run watch
```

## Available Scripts

- `npm run dev` - Run the bot in development mode
- `npm run build` - Build the TypeScript code
- `npm start` - Run the built bot
- `npm run watch` - Run in watch mode for development
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode

## Project Structure

```
src/
├── commands/          # Bot commands
│   ├── ping.ts       # Ping command example
│   └── help.ts       # Help command
├── events/            # Bot events
│   ├── messageCreate.ts
│   └── interactionCreate.ts
├── handlers/          # Command and event handlers
│   ├── CommandHandler.ts
│   └── EventHandler.ts
├── types/             # TypeScript type definitions
│   └── index.ts
├── utils/             # Utility functions
│   └── Logger.ts
└── index.ts           # Main entry point
```

## Adding New Commands

1. Create a new file in `src/commands/`
2. Export a command object following the `Command` interface
3. Register the command in your main file

Example:
```typescript
import { Message, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';

export const myCommand: Command = {
  name: 'mycommand',
  description: 'My custom command',
  execute: async (message: Message, args: string[]) => {
    await message.reply('Hello from my command!');
  },
  slashCommand: new SlashCommandBuilder()
    .setName('mycommand')
    .setDescription('My custom command'),
  executeSlash: async (interaction) => {
    await interaction.reply('Hello from my slash command!');
  },
};
```

## Adding New Events

1. Create a new file in `src/events/`
2. Export an event object following the `Event` interface
3. Register the event in your main file

Example:
```typescript
import { Client, GuildMember } from 'discord.js';
import { Event } from '../types';

export const guildMemberAdd: Event = {
  name: 'guildMemberAdd',
  execute: async (client: Client, member: GuildMember) => {
    console.log(`${member.user.tag} joined the server!`);
  },
};
```

## Configuration

### TypeScript Configuration
The project uses strict TypeScript configuration for better type safety and code quality.

### ESLint Configuration
ESLint is configured with TypeScript-specific rules for consistent code style.

### Prettier Configuration
Prettier is configured for consistent code formatting.

## Testing

The project includes Jest configuration for unit testing. Write tests in the `__tests__` directory or alongside your source files with `.test.ts` or `.spec.ts` extensions.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

If you encounter any issues or have questions, please open an issue on GitHub. 