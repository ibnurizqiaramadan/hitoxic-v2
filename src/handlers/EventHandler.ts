import { Client, Collection } from 'discord.js';
import { Event } from '../types';
import { Logger } from '../utils/Logger';

export class EventHandler {
  private client: Client;
  private events: Collection<string, Event>;
  private logger: Logger;

  constructor(client: Client) {
    this.client = client;
    this.events = new Collection();
    this.logger = new Logger();
  }

  registerEvent(event: Event): void {
    this.events.set(event.name, event);

    if (event.once) {
      this.client.once(event.name, (...args) =>
        event.execute(this.client, ...args)
      );
    } else {
      this.client.on(event.name, (...args) =>
        event.execute(this.client, ...args)
      );
    }

    this.logger.info(`Registered event: ${event.name}`);
  }

  getEvents(): Collection<string, Event> {
    return this.events;
  }
}
