import { ping } from '../commands/ping';

describe('Ping Command', () => {
  it('should have the correct name', () => {
    expect(ping.name).toBe('ping');
  });

  it('should have the correct description', () => {
    expect(ping.description).toBe('Ping the bot to check latency');
  });

  it('should have aliases', () => {
    expect(ping.aliases).toContain('p');
  });

  it('should have a cooldown', () => {
    expect(ping.cooldown).toBe(5);
  });
});
