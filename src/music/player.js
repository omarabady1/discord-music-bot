import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import { config } from '../config.js';
import { UserFacingError, describeError } from '../errors.js';
import { log, logError } from '../logger.js';
import { createPcmStream } from './audio.js';
import { resolveStream } from './youtube.js';
import { buildIdlePayload, buildPlayerPayload } from '../ui/nowPlaying.js';
import { formatDuration, truncate } from '../utils/time.js';

const MAX_HISTORY = 50;
const PREVIOUS_RESTART_THRESHOLD_MS = 3000;
const MAX_CONSECUTIVE_FAILURES = 3;

export class GuildPlayer {
  constructor({ guildId, adapterCreator, client, onDestroy }) {
    this.guildId = guildId;
    this.adapterCreator = adapterCreator;
    this.client = client;
    this.onDestroy = onDestroy;

    this.queue = [];
    this.history = [];
    this.current = null;
    this.textChannel = null;
    this.voiceChannelId = null;

    this.connection = null;
    this.audioProcess = null;
    this.nowPlayingMessage = null;
    this.idleTimer = null;
    this.destroyed = false;
    this.generation = 0;
    this.suppressIdle = false;
    this.failures = 0;

    this.offsetMs = 0;
    this.renderChain = Promise.resolve();

    this.audioPlayer = createAudioPlayer();
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => this.#onIdle());
    this.audioPlayer.on('error', (error) => {
      logError(`[${guildId}] audio player error:`, error);
    });

    this.progressTimer = setInterval(() => {
      if (
        this.current &&
        this.audioPlayer.state.status === AudioPlayerStatus.Playing
      ) {
        void this.refreshNowPlaying();
      }
    }, 15_000);
    this.progressTimer.unref?.();
  }

  get isPaused() {
    return (
      this.audioPlayer.state.status === AudioPlayerStatus.Paused ||
      this.audioPlayer.state.status === AudioPlayerStatus.AutoPaused
    );
  }

  get positionMs() {
    if (!this.current) return 0;

    const state = this.audioPlayer.state;
    const played =
      state.status === AudioPlayerStatus.Playing ||
      state.status === AudioPlayerStatus.Paused ||
      state.status === AudioPlayerStatus.AutoPaused
        ? (state.playbackDuration ?? 0)
        : 0;

    const position = this.offsetMs + played;
    return this.current.durationMs
      ? Math.min(position, this.current.durationMs)
      : position;
  }

  async connect(voiceChannel, textChannel) {
    this.setTextChannel(textChannel);
    this.voiceChannelId = voiceChannel.id;

    const existing = this.connection;
    if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
      if (existing.joinConfig.channelId !== voiceChannel.id) {
        existing.rejoin({
          channelId: voiceChannel.id,
          selfDeaf: true,
          selfMute: false,
        });
      }

      await this.#waitUntilReady(existing);
      return;
    }

    let connection;
    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: this.guildId,
        adapterCreator: this.adapterCreator,
        selfDeaf: true,
        selfMute: false,
      });
    } catch (error) {
      throw new UserFacingError(
        `Could not join that voice channel: ${describeError(error)}`,
      );
    }

    this.connection = connection;
    this.#attachConnection(connection);
    await this.#waitUntilReady(connection);
  }

  async #waitUntilReady(connection) {
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch {
      await this.destroy('I could not join the voice channel.');
      throw new UserFacingError(
        'Could not join the voice channel. Check my Connect and Speak permissions.',
      );
    }
  }

  #attachConnection(connection) {
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      if (this.destroyed) return;

      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        await this.destroy('I was disconnected from the voice channel.');
      }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      if (!this.destroyed) {
        void this.destroy('The voice connection was closed.');
      }
    });

    connection.subscribe(this.audioPlayer);
  }

  setTextChannel(channel) {
    if (!channel || this.textChannel?.id === channel.id) return;

    if (this.nowPlayingMessage) {
      const previous = this.nowPlayingMessage;
      this.nowPlayingMessage = null;
      previous
        .edit(buildIdlePayload('I moved the player to another channel.'))
        .catch(() => {});
    }

    this.textChannel = channel;
  }

  enqueue(tracks, { requestedBy } = {}) {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      throw new UserFacingError('There is nothing to queue.');
    }

    for (const track of tracks) {
      track.requestedById = requestedBy?.id ?? null;
    }

    this.queue.push(...tracks);
    this.#clearIdleTimer();

    if (!this.current) {
      this.#advance();
    } else {
      void this.refreshNowPlaying();
    }
  }

  pause() {
    if (
      !this.current ||
      this.audioPlayer.state.status !== AudioPlayerStatus.Playing
    ) {
      return false;
    }

    const paused = this.audioPlayer.pause();
    if (paused) void this.refreshNowPlaying();
    return paused;
  }

  resume() {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Paused) {
      return false;
    }

    const resumed = this.audioPlayer.unpause();
    if (resumed) void this.refreshNowPlaying();
    return resumed;
  }

  togglePause() {
    if (this.isPaused) return this.resume() ? 'resumed' : null;
    return this.pause() ? 'paused' : null;
  }

  seek(targetMs) {
    if (!this.current) throw new UserFacingError('Nothing is playing.');
    if (this.current.isLive) {
      throw new UserFacingError('Live streams cannot be seeked.');
    }

    const duration = this.current.durationMs;
    let position = Math.max(0, Math.round(targetMs));
    if (duration) position = Math.min(position, Math.max(0, duration - 1000));

    void this.#startTrack(this.current, position);
    return position;
  }

  skip() {
    if (!this.current) throw new UserFacingError('Nothing is playing.');

    if (this.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      this.current = null;
      this.#advance();
      return;
    }

    this.audioPlayer.stop(true);
  }

  previous() {
    if (!this.current) throw new UserFacingError('Nothing is playing.');

    if (
      this.positionMs > PREVIOUS_RESTART_THRESHOLD_MS ||
      this.history.length === 0
    ) {
      const track = this.current;
      void this.#startTrack(track, 0);
      return { track, restarted: true };
    }

    const previousTrack = this.history.pop();
    const discarded = this.current;
    this.queue.unshift(discarded);
    void this.#startTrack(previousTrack, 0);

    return { track: previousTrack, restarted: false };
  }

  async stop(reason = 'Stopped.') {
    await this.destroy(reason);
  }

  async refreshNowPlaying() {
    if (!this.current || this.destroyed) return;

    const generation = this.generation;

    this.renderChain = this.renderChain
      .then(async () => {
        if (
          this.destroyed ||
          generation !== this.generation ||
          !this.current
        ) {
          return;
        }

        const payload = buildPlayerPayload({
          track: this.current,
          positionMs: this.positionMs,
          paused: this.isPaused,
          queue: this.queue,
        });

        await this.#render(payload);
      })
      .catch((error) => {
        logError(`[${this.guildId}] could not update the player:`, error);
      });

    await this.renderChain;
  }

  async destroy(reason = 'Player closed.') {
    if (this.destroyed) return;

    this.destroyed = true;
    this.generation += 1;
    this.onDestroy?.();

    this.#killAudio();
    this.#clearIdleTimer();
    clearInterval(this.progressTimer);
    this.progressTimer = null;

    this.queue = [];
    this.history = [];
    this.current = null;

    this.audioPlayer.stop(true);

    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }

    if (this.nowPlayingMessage) {
      const message = this.nowPlayingMessage;
      this.nowPlayingMessage = null;
      await this.renderChain.catch(() => {});
      await message.edit(buildIdlePayload(reason)).catch(() => {});
    }
  }

  #onIdle() {
    if (this.destroyed) return;

    if (this.suppressIdle) {
      this.suppressIdle = false;
      return;
    }

    this.#advance();
  }

  #advance() {
    this.generation += 1;
    this.#killAudio();

    const finished = this.current;
    this.current = null;

    if (finished) {
      this.history.push(finished);
      if (this.history.length > MAX_HISTORY) this.history.shift();
    }

    const next = this.queue.shift();
    if (!next) {
      void this.#finish();
      return;
    }

    void this.#startTrack(next, 0);
  }

  async #startTrack(track, offsetMs) {
    const generation = ++this.generation;

    this.current = track;
    this.offsetMs = offsetMs;
    this.#clearIdleTimer();
    this.#killAudio();
    this.#silence();

    try {
      const stream = await resolveStream(track);
      if (this.destroyed || generation !== this.generation) return;

      const pcm = createPcmStream({
        url: stream.url,
        headers: stream.headers,
        seekMs: offsetMs,
      });

      this.audioProcess = pcm;

      const resource = createAudioResource(pcm.stream, {
        inputType: StreamType.Raw,
        metadata: track,
      });
      resource.playStream.once('close', () => pcm.kill());

      this.audioPlayer.play(resource);
      this.failures = 0;

      await this.refreshNowPlaying();
      log(
        `[${this.guildId}] playing "${track.title}" at ${formatDuration(offsetMs)}`,
      );
    } catch (error) {
      if (this.destroyed || generation !== this.generation) return;

      logError(`[${this.guildId}] failed to play "${track.title}":`, error);

      this.failures += 1;
      this.#killAudio();
      this.current = null;

      const notice = `⚠️ Skipping **${truncate(track.title, 80)}** — ${describeError(error)}`;

      if (this.failures >= MAX_CONSECUTIVE_FAILURES) {
        this.queue = [];
        void this.#notify(notice);
        await this.#finish('Stopped after several tracks failed to play.');
        return;
      }

      void this.#notify(notice);
      this.#advance();
    }
  }

  #silence() {
    this.suppressIdle = true;
    const stopped = this.audioPlayer.stop(true);
    if (!stopped) this.suppressIdle = false;
  }

  async #finish(message) {
    if (this.destroyed) return;

    this.current = null;
    this.failures = 0;
    await this.#renderIdle(
      message ?? 'Queue finished. Add more songs with `/play`.',
    );
    this.#scheduleIdleDisconnect();
  }

  async #render(payload) {
    if (!this.textChannel?.isTextBased()) return;

    if (this.nowPlayingMessage) {
      try {
        await this.nowPlayingMessage.edit(payload);
        return;
      } catch {
        this.nowPlayingMessage = null;
      }
    }

    try {
      this.nowPlayingMessage = await this.textChannel.send(payload);
    } catch (error) {
      logError(`[${this.guildId}] could not send the player message:`, error);
    }
  }

  async #renderIdle(message) {
    if (!this.nowPlayingMessage || this.current) return;

    this.renderChain = this.renderChain
      .then(async () => {
        if (this.destroyed || this.current || !this.nowPlayingMessage) return;

        try {
          await this.nowPlayingMessage.edit(buildIdlePayload(message));
        } catch {
          this.nowPlayingMessage = null;
        }
      })
      .catch(() => {});

    await this.renderChain;
  }

  async #notify(content) {
    if (!this.textChannel?.isTextBased()) return;
    await this.textChannel.send({ content }).catch(() => {});
  }

  #scheduleIdleDisconnect() {
    if (this.destroyed || config.idleDisconnectMs <= 0) return;

    this.#clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.destroyed || this.current) return;
      void this.destroy('Left the voice channel after being idle.');
    }, config.idleDisconnectMs);

    this.idleTimer.unref?.();
  }

  #clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  #killAudio() {
    if (!this.audioProcess) return;
    const audio = this.audioProcess;
    this.audioProcess = null;
    audio.kill();
  }
}
