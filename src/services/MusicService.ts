import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnectionStatus,
  VoiceConnectionDisconnectReason,
  NoSubscriberBehavior,
  entersState,
  getVoiceConnection,
  VoiceConnection,
} from '@discordjs/voice';
import {
  Guild,
  GuildMember,
  TextChannel,
  EmbedBuilder,
  VoiceBasedChannel,
  VoiceState,
} from 'discord.js';
import play from 'play-dl';
import { Logger } from '../utils/Logger';
import YTDlpWrap from 'yt-dlp-wrap';
import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export interface Song {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string | undefined;
  requestedBy: string;
  id: string;
}

export interface MusicQueue {
  songs: Song[];
  volume: number;
  playing: boolean;
  loop: boolean;
  textChannel: TextChannel;
  voiceConnection: VoiceConnection;
  audioPlayer: AudioPlayer;
}

interface NodeError extends Error {
  code?: string;
}

interface SongInfo {
  title?: string;
  url?: string;
  id?: string;
  duration?: number;
  durationInSec?: number;
  durationRaw?: string;
  thumbnails?: Array<{ url: string }>;
}

export class MusicService {
  private static instance: MusicService;
  private queues: Map<string, MusicQueue> = new Map();
  private logger: Logger;
  private emptyChannelTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private constructor() {
    this.logger = new Logger();
  }

  public static getInstance(): MusicService {
    if (!MusicService.instance) {
      MusicService.instance = new MusicService();
    }
    return MusicService.instance;
  }

  public async play(
    guild: Guild,
    member: GuildMember,
    query: string,
    textChannel: TextChannel
  ): Promise<{ success: boolean; message: string | EmbedBuilder }> {
    try {
      // Check if user is in voice channel
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        return { success: false, message: '❌ You need to be in a voice channel to use this command!' };
      }

      // Debug info
      this.logger.info(`Guild: ${guild.name} (${guild.id})`);
      this.logger.info(`User: ${member.user.username} (${member.id})`);
      this.logger.info(`Voice Channel: ${voiceChannel.name} (${voiceChannel.id})`);
      this.logger.info(`Bot User: ${guild.members.me?.user.username} (${guild.members.me?.id})`);
      
      // Check if bot is ready
      if (!guild.members.me) {
        this.logger.error('Bot is not a member of this guild');
        return { success: false, message: '❌ Bot is not ready yet. Please try again in a moment!' };
      }

      this.logger.info(`Bot Permissions: ${voiceChannel.permissionsFor(guild.members.me).toArray().join(', ')}`);
      
      // Check if bot is connected to Discord
      if (!guild.client.isReady()) {
        this.logger.error('Bot client is not ready');
        return { success: false, message: '❌ Bot is not ready yet. Please try again in a moment!' };
      }

      // Check if bot is already in a voice channel
      const botMember = guild.members.me;
      let useExistingConnection = false;
      
      if (botMember && botMember.voice.channel) {
        this.logger.info(`Bot is already in voice channel: ${botMember.voice.channel.name}`);
        
        // If bot is already in the requested channel, use existing connection
        if (botMember.voice.channel.id === voiceChannel.id) {
          this.logger.info('Bot is already in the requested voice channel, using existing connection');
          const existingConnection = getVoiceConnection(guild.id);
          if (existingConnection) {
            this.logger.info('Using existing voice connection');
            useExistingConnection = true;
          }
        } else {
          this.logger.info(`Moving bot from ${botMember.voice.channel.name} to ${voiceChannel.name}`);
        }
      }

      // Check if user has permission to connect to voice channel
      if (!voiceChannel.permissionsFor(member).has('Connect')) {
        return { success: false, message: '❌ You need permission to connect to this voice channel!' };
      }

      // Check if bot has permission to connect to voice channel
      if (!voiceChannel.permissionsFor(guild.members.me).has('Connect')) {
        return { success: false, message: '❌ I need permission to connect to this voice channel!' };
      }

      // Check if bot has permission to speak in voice channel
      if (!voiceChannel.permissionsFor(guild.members.me).has('Speak')) {
        return { success: false, message: '❌ I need permission to speak in this voice channel!' };
      }

      // Check if voice channel is full
      if (voiceChannel.userLimit && voiceChannel.members.size >= voiceChannel.userLimit) {
        return { success: false, message: '❌ This voice channel is full!' };
      }

      // Get or create queue
      let queue = this.queues.get(guild.id);
      if (!queue) {
        if (useExistingConnection) {
          const existingConnection = getVoiceConnection(guild.id);
          if (existingConnection) {
            queue = await this.createQueueWithExistingConnection(guild, voiceChannel, textChannel, existingConnection);
          } else {
            queue = await this.createQueue(guild, voiceChannel, textChannel);
          }
        } else {
          queue = await this.createQueue(guild, voiceChannel, textChannel);
        }
      }

      // Search for song
      const songInfo = await this.searchSong(query);
      if (!songInfo) {
        return { success: false, message: '❌ Could not find any songs with that query!' };
      }

      // Debug logging
      this.logger.info('Song info:', { 
        title: songInfo.title, 
        url: songInfo.url, 
        id: songInfo.id,
        duration: songInfo.duration,
        durationInSec: songInfo.durationInSec,
        durationRaw: songInfo.durationRaw
      });

      if (!songInfo.url) {
        this.logger.error('Song info has no URL:', songInfo);
        return { success: false, message: '❌ Could not get song URL!' };
      }

      // Try different duration properties from play-dl
      let duration = 0;
      if (songInfo.durationInSec) {
        duration = songInfo.durationInSec;
      } else if (songInfo.durationRaw) {
        // Parse duration from format like "4:23" to seconds
        const timeMatch = songInfo.durationRaw.match(/(\d+):(\d+)/);
        if (timeMatch && timeMatch[1] && timeMatch[2]) {
          const minutes = parseInt(timeMatch[1], 10);
          const seconds = parseInt(timeMatch[2], 10);
          duration = minutes * 60 + seconds;
        }
      } else if (songInfo.duration) {
        duration = songInfo.duration;
      }

      this.logger.info(`Extracted duration: ${duration} seconds`);

      const song: Song = {
        title: songInfo.title || 'Unknown Title',
        url: songInfo.url || '',
        duration: duration,
        thumbnail: songInfo.thumbnails?.[0]?.url,
        requestedBy: member.user.username,
        id: songInfo.id || Date.now().toString(),
      };

      // Add song to queue
      queue.songs.push(song);

      // If not playing, start playing
      if (!queue.playing) {
        await this.playNext(guild.id);
      }

      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Added to Queue')
        .setDescription(`**${song.title}**`)
        .addFields(
          { name: 'Duration', value: this.formatDuration(song.duration), inline: true },
          { name: 'Requested by', value: song.requestedBy, inline: true },
          { name: 'Position in queue', value: queue.songs.length.toString(), inline: true }
        )
        .setThumbnail(song.thumbnail || null)
        .setTimestamp();

      return { success: true, message: embed };
    } catch (error) {
      this.logger.error('Error in play command:', error);
      return { success: false, message: '❌ An error occurred while trying to play the song!' };
    }
  }

  public async skip(guild: Guild): Promise<{ success: boolean; message: string }> {
    try {
      const queue = this.queues.get(guild.id);
      
      // Debug logging for skip command
      this.logger.info(`Skip command - Queue exists: ${!!queue}`);
      if (queue) {
        this.logger.info(`Skip command - Queue playing: ${queue.playing}`);
        this.logger.info(`Skip command - Queue songs count: ${queue.songs.length}`);
        this.logger.info(`Skip command - Audio player status: ${queue.audioPlayer.state.status}`);
      }
      
      if (!queue) {
        return { success: false, message: '❌ Nothing is currently playing!' };
      }
      
      // Check if queue has songs and audio player is actually playing
      if (queue.songs.length === 0) {
        queue.playing = false; // Update state
        return { success: false, message: '❌ Nothing is currently playing!' };
      }
      
      // If audio player is not playing but we have songs, something is wrong
      if (queue.audioPlayer.state.status !== AudioPlayerStatus.Playing && 
          queue.audioPlayer.state.status !== AudioPlayerStatus.Buffering) {
        this.logger.warn(`Audio player status is ${queue.audioPlayer.state.status} but queue has ${queue.songs.length} songs`);
        queue.playing = false; // Update state
        return { success: false, message: '❌ Nothing is currently playing!' };
      }

      this.logger.info(`Skipping current song: ${queue.songs[0]?.title}`);
      queue.audioPlayer.stop();
      return { success: true, message: '⏭️ Skipped the current song!' };
    } catch (error) {
      this.logger.error('Error in skip command:', error);
      return { success: false, message: '❌ An error occurred while trying to skip!' };
    }
  }

  public async stop(guild: Guild): Promise<{ success: boolean; message: string }> {
    try {
      const queue = this.queues.get(guild.id);
      if (!queue) {
        return { success: false, message: '❌ Nothing is currently playing!' };
      }

      queue.songs = [];
      queue.playing = false;
      queue.audioPlayer.stop();
      queue.voiceConnection.destroy();
      this.queues.delete(guild.id);
      
      // Cancel any empty channel timer
      this.cancelEmptyChannelTimer(guild.id);

      return { success: true, message: '⏹️ Stopped the music and cleared the queue!' };
    } catch (error) {
      this.logger.error('Error in stop command:', error);
      return { success: false, message: '❌ An error occurred while trying to stop!' };
    }
  }

  public async pause(guild: Guild): Promise<{ success: boolean; message: string }> {
    try {
      const queue = this.queues.get(guild.id);
      if (!queue || !queue.playing) {
        return { success: false, message: '❌ Nothing is currently playing!' };
      }

      queue.audioPlayer.pause();
      return { success: true, message: '⏸️ Paused the music!' };
    } catch (error) {
      this.logger.error('Error in pause command:', error);
      return { success: false, message: '❌ An error occurred while trying to pause!' };
    }
  }

  public async resume(guild: Guild): Promise<{ success: boolean; message: string }> {
    try {
      const queue = this.queues.get(guild.id);
      if (!queue || !queue.playing) {
        return { success: false, message: '❌ Nothing is currently playing!' };
      }

      queue.audioPlayer.unpause();
      return { success: true, message: '▶️ Resumed the music!' };
    } catch (error) {
      this.logger.error('Error in resume command:', error);
      return { success: false, message: '❌ An error occurred while trying to resume!' };
    }
  }

  public async queue(guild: Guild): Promise<{ success: boolean; message: string | EmbedBuilder }> {
    try {
      const queue = this.queues.get(guild.id);
      if (!queue || queue.songs.length === 0) {
        return { success: false, message: '❌ The queue is empty!' };
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎵 Music Queue')
        .setDescription(`**${queue.songs.length} songs in queue**`);

      const songList = queue.songs
        .slice(0, 10)
        .map((song, index) => {
          const duration = this.formatDuration(song.duration);
          return `${index + 1}. **${song.title}** - ${duration} (${song.requestedBy})`;
        })
        .join('\n');

      embed.addFields({
        name: 'Current Queue',
        value: songList || 'No songs in queue',
        inline: false,
      });

      if (queue.songs.length > 10) {
        embed.setFooter({ text: `And ${queue.songs.length - 10} more songs...` });
      }

      return { success: true, message: embed };
    } catch (error) {
      this.logger.error('Error in queue command:', error);
      return { success: false, message: '❌ An error occurred while getting the queue!' };
    }
  }

  public async volume(guild: Guild, volume: number): Promise<{ success: boolean; message: string }> {
    try {
      const queue = this.queues.get(guild.id);
      if (!queue) {
        return { success: false, message: '❌ Nothing is currently playing!' };
      }

      if (volume < 0 || volume > 100) {
        return { success: false, message: '❌ Volume must be between 0 and 100!' };
      }

      queue.volume = volume / 100;
      
      // Volume will be applied to next song
      this.logger.info(`Volume set to ${volume}% for guild ${guild.id}`);

      return { success: true, message: `🔊 Volume set to ${volume}%!` };
    } catch (error) {
      this.logger.error('Error in volume command:', error);
      return { success: false, message: '❌ An error occurred while setting volume!' };
    }
  }

  public async loop(guild: Guild): Promise<{ success: boolean; message: string }> {
    try {
      const queue = this.queues.get(guild.id);
      if (!queue) {
        return { success: false, message: '❌ Nothing is currently playing!' };
      }

      queue.loop = !queue.loop;
      return { 
        success: true, 
        message: queue.loop ? '🔁 Loop mode enabled!' : '🔁 Loop mode disabled!' 
      };
    } catch (error) {
      this.logger.error('Error in loop command:', error);
      return { success: false, message: '❌ An error occurred while toggling loop!' };
    }
  }

  private async createQueue(
    guild: Guild,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextChannel
  ): Promise<MusicQueue> {
    const audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    this.logger.info(`Attempting to join voice channel: ${voiceChannel.name} (${voiceChannel.id})`);
    
    // Check if voice adapter is available
    if (!guild.voiceAdapterCreator) {
      this.logger.error('Voice adapter creator is not available');
      throw new Error('Voice adapter not available');
    }
    
    this.logger.info('Voice adapter creator is available');
    
    // Check if already connected to this voice channel
    const existingConnection = getVoiceConnection(guild.id);
    if (existingConnection) {
      this.logger.info('Already connected to a voice channel, destroying existing connection');
      existingConnection.destroy();
      // Wait a bit for the connection to be destroyed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    let voiceConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    // Wait for initial connection with longer timeout and improved retry logic
    const maxRetries = 3;
    let connectionSuccessful = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Connection attempt ${attempt}/${maxRetries} to voice channel: ${voiceChannel.name}`);
        
        // Use longer timeout and try different connection states
        await Promise.race([
          entersState(voiceConnection, VoiceConnectionStatus.Ready, 15_000),
          entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000).then(() => 
            entersState(voiceConnection, VoiceConnectionStatus.Ready, 10_000)
          )
        ]);
        
        this.logger.info(`Successfully connected to voice channel: ${voiceChannel.name} on attempt ${attempt}`);
        connectionSuccessful = true;
        break;
      } catch (error) {
        this.logger.error(`Connection attempt ${attempt}/${maxRetries} failed for voice channel: ${voiceChannel.name}`, error);
        
        if (attempt < maxRetries) {
          // Clean up failed connection
          try {
            voiceConnection.destroy();
          } catch (destroyError) {
            this.logger.warn('Failed to destroy connection during retry:', destroyError);
          }
          
          // Wait before retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          this.logger.info(`Waiting ${retryDelay}ms before retry attempt ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Create new connection for retry
          voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
          });
        }
      }
    }
    
    if (!connectionSuccessful) {
      // Final cleanup on complete failure
      try {
        voiceConnection.destroy();
      } catch (destroyError) {
        this.logger.warn('Failed to destroy connection after all retries:', destroyError);
      }
      throw new Error(`Failed to connect to voice channel: ${voiceChannel.name} after ${maxRetries} attempts`);
    }

    voiceConnection.on(VoiceConnectionStatus.Ready, () => {
      this.logger.info(`Connected to voice channel: ${voiceChannel.name}`);
    });

    voiceConnection.on(VoiceConnectionStatus.Connecting, () => {
      this.logger.info(`Connecting to voice channel: ${voiceChannel.name}`);
    });

    voiceConnection.on(VoiceConnectionStatus.Signalling, () => {
      this.logger.info(`Signalling to voice channel: ${voiceChannel.name}`);
    });

    voiceConnection.on(VoiceConnectionStatus.Disconnected, async (_oldState, newState) => {
      this.logger.info(`Disconnected from voice channel: ${voiceChannel.name}. Reason: ${newState.reason || 'Unknown'}`);
      
      // Don't try to reconnect if the disconnection was manual (user-initiated)
      if (newState.reason === VoiceConnectionDisconnectReason.Manual) {
        this.logger.info('Connection closed manually, not attempting reconnection');
        return;
      }
      
      try {
        // Try to reconnect with longer timeout
        await Promise.race([
          entersState(voiceConnection, VoiceConnectionStatus.Signalling, 10_000),
          entersState(voiceConnection, VoiceConnectionStatus.Connecting, 10_000),
        ]);
        this.logger.info('Successfully reconnected to voice channel');
      } catch (error) {
        this.logger.error('Failed to automatically reconnect:', error);
        
        // Clean up and remove queue
        try {
          voiceConnection.destroy();
        } catch (destroyError) {
          this.logger.warn('Failed to destroy connection during cleanup:', destroyError);
        }
        
        this.queues.delete(guild.id);
        
        // Notify text channel about disconnection
        try {
          await textChannel.send('❌ **Voice connection lost and could not be restored.** Use the play command again to reconnect.');
        } catch (messageError) {
          this.logger.warn('Failed to send disconnection message to text channel:', messageError);
        }
      }
    });

    const queue: MusicQueue = {
      songs: [],
      volume: 1,
      playing: false,
      loop: false,
      textChannel,
      voiceConnection,
      audioPlayer,
    };

    this.queues.set(guild.id, queue);
    return queue;
  }

  private async createQueueWithExistingConnection(
    guild: Guild,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextChannel,
    existingConnection: VoiceConnection
  ): Promise<MusicQueue> {
    const audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    // Set up event listeners for existing connection
    existingConnection.on(VoiceConnectionStatus.Ready, () => {
      this.logger.info(`Using existing connection to voice channel: ${voiceChannel.name}`);
    });

    existingConnection.on(VoiceConnectionStatus.Connecting, () => {
      this.logger.info(`Existing connection connecting to voice channel: ${voiceChannel.name}`);
    });

    existingConnection.on(VoiceConnectionStatus.Signalling, () => {
      this.logger.info(`Existing connection signalling to voice channel: ${voiceChannel.name}`);
    });

    existingConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      this.logger.info(`Existing connection disconnected from voice channel: ${voiceChannel.name}`);
      try {
        await Promise.race([
          entersState(existingConnection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(existingConnection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        this.logger.info('Existing connection reconnected to voice channel');
      } catch (error) {
        this.logger.error('Failed to reconnect existing connection, destroying connection');
        existingConnection.destroy();
        this.queues.delete(guild.id);
      }
    });

    const queue: MusicQueue = {
      songs: [],
      volume: 1,
      playing: false,
      loop: false,
      textChannel,
      voiceConnection: existingConnection,
      audioPlayer,
    };

    this.queues.set(guild.id, queue);
    return queue;
  }

  private async searchSong(query: string): Promise<SongInfo | null> {
    try {
      this.logger.info('Searching for song:', query);
      
      if (play.yt_validate(query) === 'video') {
        this.logger.info('Valid YouTube URL detected');
        const videoInfo = await play.video_info(query);
        const details = videoInfo.video_details;
        this.logger.info('Video details:', { 
          title: details.title, 
          url: details.url, 
          id: details.id,
          durationInSec: details.durationInSec
        });
        return details;
      } else {
        this.logger.info('Searching YouTube for:', query);
        const searchResults = await play.search(query, { limit: 1 });
        this.logger.info('Search results count:', searchResults.length);
        
        if (searchResults.length > 0) {
          const result = searchResults[0];
          if (!result) {
            this.logger.error('Search result is undefined');
            return null;
          }
          
          this.logger.info('Search result basic info:', { 
            title: result.title, 
            url: result.url, 
            id: result.id,
            durationInSec: result.durationInSec,
            durationRaw: result.durationRaw
          });
          
          // Ensure we have a valid URL
          if (!result.url) {
            this.logger.error('Search result has no URL:', result);
            return null;
          }

          // Get detailed video info to ensure we have duration
          try {
            this.logger.info('Getting detailed video info for better duration data...');
            const videoInfo = await play.video_info(result.url);
            const details = videoInfo.video_details;
            
            this.logger.info('Detailed video info:', { 
              title: details.title, 
              url: details.url, 
              id: details.id,
              durationInSec: details.durationInSec
            });
            
            return details;
          } catch (detailError) {
            this.logger.warn('Failed to get detailed video info, using search result:', detailError);
            return result;
          }
        }
      }
      return null;
    } catch (error) {
      this.logger.error('Error searching for song:', error);
      return null;
    }
  }

  private async playNext(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue || queue.songs.length === 0) {
      if (queue) queue.playing = false;
      return;
    }

    const song = queue.songs[0];
    if (!song) return;
    
    queue.playing = true;

    try {
      if (!song.url) {
        throw new Error('Invalid song URL');
      }
      
      // Download and play file approach
      const filePath = await this.downloadSong(song);
      
      // Verify file exists before creating resource
      try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        if (stats.size === 0) {
          throw new Error('File is empty');
        }
      } catch (error) {
        this.logger.error('File verification failed:', error);
        throw new Error('Downloaded file is not accessible');
      }

      // Convert to compatible format
      let audioFilePath = filePath;
      try {
        audioFilePath = await this.convertToCompatibleFormat(filePath);
      } catch (conversionError) {
        this.logger.warn('Conversion failed, using original file:', conversionError);
        audioFilePath = filePath;
      }
      
      // Create audio resource with better stream handling
      const fileStream = createReadStream(audioFilePath);
      
      // Add error handling for the file stream - gracefully handle interruptions
      fileStream.on('error', (error: NodeError) => {
        // Check if this is a premature close (song was skipped/stopped)
        if (error.code === 'ERR_STREAM_PREMATURE_CLOSE' || error.message.includes('Premature close')) {
          this.logger.info('File stream closed due to skip/stop - this is normal');
        } else {
          this.logger.error('File stream error:', error);
          // Don't throw here - just log and let the audio player handle it
          // The audioPlayer error handler will take care of advancing to next song
        }
      });

      // Add close handler for cleanup
      fileStream.on('close', () => {
        this.logger.debug('File stream closed');
      });

      const resource = createAudioResource(fileStream, {
        inlineVolume: true,
      });

      // Set volume
      resource.volume?.setVolume(queue.volume);

      // Check if voice connection is still ready
      this.logger.info(`Voice connection status: ${queue.voiceConnection.state.status}`);
      
      if (queue.voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
        this.logger.warn('Voice connection not ready, attempting to reconnect...');
        try {
          await entersState(queue.voiceConnection, VoiceConnectionStatus.Ready, 5_000);
          this.logger.info('Voice connection is ready');
        } catch (error) {
          this.logger.error('Voice connection failed to be ready:', error);
          
          // Try to rejoin the voice channel
          try {
            this.logger.info('Attempting to rejoin voice channel...');
            queue.voiceConnection.rejoin();
            await entersState(queue.voiceConnection, VoiceConnectionStatus.Ready, 5_000);
            this.logger.info('Rejoin successful');
          } catch (rejoinError) {
            this.logger.error('Rejoin failed:', rejoinError);
            throw new Error('Voice connection not ready after rejoin attempt');
          }
        }
      } else {
        this.logger.info('Voice connection is ready');
      }

      // Check if audio player is already playing
      if (queue.audioPlayer.state.status === AudioPlayerStatus.Playing) {
        this.logger.info('Audio player is already playing, stopping current playback');
        queue.audioPlayer.stop();
        // Wait a bit for the stop to take effect
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Remove all existing listeners to prevent duplicates
      queue.audioPlayer.removeAllListeners(AudioPlayerStatus.Playing);
      queue.audioPlayer.removeAllListeners(AudioPlayerStatus.Buffering);
      queue.audioPlayer.removeAllListeners(AudioPlayerStatus.AutoPaused);
      queue.audioPlayer.removeAllListeners(AudioPlayerStatus.Paused);
      queue.audioPlayer.removeAllListeners(AudioPlayerStatus.Idle);
      queue.audioPlayer.removeAllListeners('error');

      queue.audioPlayer.play(resource);
      
      // Make sure voice connection is subscribed to audio player
      const currentSubscription = queue.voiceConnection.state.status === VoiceConnectionStatus.Ready 
        ? queue.voiceConnection.state.subscription 
        : null;
      
      if (!currentSubscription) {
        this.logger.info('Subscribing voice connection to audio player');
        queue.voiceConnection.subscribe(queue.audioPlayer);
      } else {
        this.logger.info('Voice connection already subscribed to audio player');
      }

      // Set up event listeners (after removing old ones to prevent duplicates)
      queue.audioPlayer.on(AudioPlayerStatus.Playing, () => {
        this.logger.info(`Now playing: ${song.title}`);
      });

      queue.audioPlayer.on(AudioPlayerStatus.Buffering, () => {
        this.logger.info(`Buffering: ${song.title}`);
      });

      queue.audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
        this.logger.info(`Auto paused: ${song.title}`);
      });

      queue.audioPlayer.on(AudioPlayerStatus.Paused, () => {
        this.logger.info(`Paused: ${song.title}`);
      });

      queue.audioPlayer.on(AudioPlayerStatus.Idle, () => {
        if (queue.loop) {
          // Keep the same song
          this.playNext(guildId);
        } else {
          // Remove the song and play next
          queue.songs.shift();
          this.playNext(guildId);
        }
      });

      queue.audioPlayer.on('error', (error) => {
        this.logger.error('Audio player error:', error);
        queue.songs.shift();
        this.playNext(guildId);
      });

      // Send now playing message
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle('🎵 Now Playing')
        .setDescription(`**${song.title}**`)
        .addFields(
          { name: 'Duration', value: this.formatDuration(song.duration), inline: true },
          { name: 'Requested by', value: song.requestedBy, inline: true }
        )
        .setThumbnail(song.thumbnail || null)
        .setTimestamp();

      await queue.textChannel.send({ embeds: [embed] });

    } catch (error) {
      this.logger.error('Error playing song:', error);
      
      // Send error message to channel
      try {
        const errorEmbed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('❌ Error Playing Song')
          .setDescription(`Failed to play **${song.title}**`)
          .addFields({
            name: 'Error',
            value: 'Could not create audio stream. Please try another song.',
            inline: false,
          })
          .setTimestamp();
        
        await queue.textChannel.send({ embeds: [errorEmbed] });
      } catch (sendError) {
        this.logger.error('Error sending error message:', sendError);
      }
      
      // Remove the failed song and try next
      queue.songs.shift();
      this.playNext(guildId);
    }
  }

  private formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  public getQueue(guildId: string): MusicQueue | undefined {
    return this.queues.get(guildId);
  }

  public isPlaying(guildId: string): boolean {
    const queue = this.queues.get(guildId);
    return queue ? queue.playing : false;
  }

  public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    try {
      // Check if someone left a voice channel that has a bot connection
      if (oldState.channelId && !newState.channelId && oldState.member && oldState.channel) {
        const guild = oldState.guild;
        const queue = this.queues.get(guild.id);
        
        if (queue && oldState.channelId === oldState.guild.members.me?.voice.channelId) {
          this.logger.info(`User ${oldState.member.user.username} left voice channel ${oldState.channel.name}`);
          this.checkAndHandleEmptyChannel(guild.id, oldState.channel);
        }
      }
      
      // Check if someone joined a voice channel where the bot is (cancel empty timer)
      if (!oldState.channelId && newState.channelId && newState.member && newState.channel) {
        const guild = newState.guild;
        const queue = this.queues.get(guild.id);
        
        if (queue && newState.channelId === newState.guild.members.me?.voice.channelId) {
          this.logger.info(`User ${newState.member.user.username} joined voice channel ${newState.channel.name}`);
          this.cancelEmptyChannelTimer(guild.id);
        }
      }
    } catch (error) {
      this.logger.error('Error handling voice state update:', error);
    }
  }

  private checkAndHandleEmptyChannel(guildId: string, voiceChannel: VoiceBasedChannel): void {
    // Cancel any existing timer for this guild
    this.cancelEmptyChannelTimer(guildId);
    
    // Count non-bot members in the voice channel
    const humanMembers = voiceChannel.members.filter((member: GuildMember) => !member.user.bot);
    
    if (humanMembers.size === 0) {
      this.logger.info(`Voice channel ${voiceChannel.name} is now empty. Starting 60-second disconnect timer.`);
      
      // Set a timer to disconnect after 60 seconds
      const timer = setTimeout(() => {
        this.disconnectFromEmptyChannel(guildId, voiceChannel);
      }, 60000); // 60 seconds
      
      this.emptyChannelTimers.set(guildId, timer);
    }
  }

  private cancelEmptyChannelTimer(guildId: string): void {
    const timer = this.emptyChannelTimers.get(guildId);
    if (timer) {
      clearTimeout(timer);
      this.emptyChannelTimers.delete(guildId);
      this.logger.info(`Cancelled empty channel timer for guild ${guildId}`);
    }
  }

  private async disconnectFromEmptyChannel(guildId: string, voiceChannel: VoiceBasedChannel): Promise<void> {
    try {
      const queue = this.queues.get(guildId);
      if (!queue) {
        this.logger.info(`No queue found for guild ${guildId}, already disconnected`);
        return;
      }

      // Double-check that the channel is still empty
      const humanMembers = voiceChannel.members.filter((member: GuildMember) => !member.user.bot);
      if (humanMembers.size > 0) {
        this.logger.info(`Voice channel ${voiceChannel.name} is no longer empty, cancelling disconnect`);
        this.cancelEmptyChannelTimer(guildId);
        return;
      }

      this.logger.info(`Disconnecting bot from empty voice channel: ${voiceChannel.name}`);
      
      // Send goodbye message
      try {
        const embed = new EmbedBuilder()
          .setColor('#ffa500')
          .setTitle('👋 Left Voice Channel')
          .setDescription('I left the voice channel because it was empty for too long.')
          .addFields({
            name: 'ℹ️ Info',
            value: 'Use the `/play` command when you want me to rejoin!',
            inline: false,
          })
          .setTimestamp();

        await queue.textChannel.send({ embeds: [embed] });
      } catch (messageError) {
        this.logger.warn('Failed to send goodbye message:', messageError);
      }

      // Clean up and disconnect
      queue.songs = [];
      queue.playing = false;
      queue.audioPlayer.stop();
      queue.voiceConnection.destroy();
      this.queues.delete(guildId);
      this.cancelEmptyChannelTimer(guildId);
      
    } catch (error) {
      this.logger.error('Error disconnecting from empty channel:', error);
    }
  }

  private async downloadSong(song: Song): Promise<string> {
    try {
      // Create downloads directory if it doesn't exist
      const downloadsDir = path.join(__dirname, '../../downloads');
      await fs.mkdir(downloadsDir, { recursive: true });

      // Create filename from song ID
      const fileName = `${song.id}.mp3`;
      const filePath = path.join(downloadsDir, fileName);

      // Check if file already exists
      try {
        await fs.access(filePath);
        this.logger.info(`File already exists: ${fileName}`);
        return filePath;
      } catch {
        // File doesn't exist, download it
        this.logger.info(`Downloading song: ${song.title}`);
        
        const ytDlp = new YTDlpWrap();
        
        // Download with yt-dlp
        await ytDlp.exec([
          song.url,
          '-o', filePath,
          '-x', // Extract audio
          '--audio-format', 'mp3',
          '--audio-quality', '0', // Best quality
        ]);
        
        this.logger.info(`Download completed: ${fileName}`);
        
        // Wait a bit and verify file exists
        await this.waitForFile(filePath);
        
        return filePath;
      }
    } catch (error) {
      this.logger.error('Error in downloadSong:', error);
      throw new Error('Failed to download song');
    }
  }

  private async waitForFile(filePath: string, maxAttempts: number = 30): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await fs.access(filePath);
        const stats = await fs.stat(filePath);
        
        // Check if file has content (size > 0)
        if (stats.size > 0) {
          this.logger.info(`File verified: ${path.basename(filePath)} (${stats.size} bytes)`);
          return;
        }
      } catch (error) {
        // File doesn't exist or is empty
      }
      
      // Wait 1 second before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.logger.info(`Waiting for file... (attempt ${attempt}/${maxAttempts})`);
    }
    
    throw new Error(`File not ready after ${maxAttempts} attempts: ${path.basename(filePath)}`);
  }

  private async convertToCompatibleFormat(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace('.mp3', '_converted.opus');
    
    return new Promise((resolve, reject) => {
      this.logger.info(`Converting ${path.basename(inputPath)} to compatible format...`);
      
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-c:a', 'libopus',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        '-f', 'opus',
        outputPath,
        '-y' // Overwrite output file
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          this.logger.info(`Conversion completed: ${path.basename(outputPath)}`);
          resolve(outputPath);
        } else {
          this.logger.error(`FFmpeg conversion failed with code: ${code}`);
          reject(new Error(`FFmpeg conversion failed with code: ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error('FFmpeg error:', error);
        reject(error);
      });
    });
  }
} 