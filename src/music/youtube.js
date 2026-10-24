import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';
import { UserFacingError } from '../errors.js';
import { ytdlpPath } from '../paths.js';

const execFileAsync = promisify(execFile);
const STREAM_TTL_MS = 30 * 60_000;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

const BASE_ARGS = ['--no-warnings', '--no-progress', '--ignore-config'];
if (config.cookiesFile) BASE_ARGS.push('--cookies', config.cookiesFile);

function cleanErrorLine(raw) {
  return raw
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => line.includes('ERROR:'))
    ?.replace(/^ERROR:\s*/i, '');
}

async function runYtDlp(args) {
  try {
    const { stdout } = await execFileAsync(ytdlpPath, [...BASE_ARGS, ...args], {
      maxBuffer: MAX_OUTPUT_BYTES,
      timeout: 180_000,
      windowsHide: true,
      encoding: 'utf8',
    });
    return stdout;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new UserFacingError(
        'yt-dlp is missing. Run "npm run setup" on the bot machine.',
      );
    }

    if (error.killed) {
      throw new UserFacingError('YouTube took too long to respond. Try again.');
    }

    const raw = error.stderr || error.stdout || error.message || '';
    const line = cleanErrorLine(String(raw)) ?? 'yt-dlp failed to process that link.';

    if (/confirm you.{0,3}re not a bot|sign in to confirm/i.test(line)) {
      throw new UserFacingError(
        'YouTube wants a signed-in session for this video. Configure YTDLP_COOKIES_FILE (see README).',
      );
    }

    throw new UserFacingError(`YouTube: ${line.slice(0, 300)}`);
  }
}

function parseJson(stdout) {
  const start = stdout.indexOf('{');
  if (start === -1) throw new UserFacingError('yt-dlp returned no data.');

  try {
    return JSON.parse(stdout.slice(start));
  } catch {
    throw new UserFacingError('Could not read the response from yt-dlp.');
  }
}

function isPlaceholder(entry) {
  return /^\[(private|deleted|unavailable|members-only) video\]$/i.test(
    entry.title?.trim() ?? '',
  );
}

function isPlayableEntry(entry) {
  return Boolean(entry?.id || entry?.url) && !isPlaceholder(entry);
}

function entryIsLive(entry) {
  return (
    entry?.is_live === true ||
    entry?.live_status === 'is_live' ||
    entry?.live_status === 'is_upcoming'
  );
}

function pickThumbnail(info) {
  if (info.thumbnail) return info.thumbnail;
  const thumbnails = Array.isArray(info.thumbnails) ? info.thumbnails : [];
  return thumbnails.at(-1)?.url ?? null;
}

function entryToTrack(entry) {
  const id = entry.id ?? null;
  const url = /^https?:\/\//.test(entry.url ?? '')
    ? entry.url
    : id
      ? `https://www.youtube.com/watch?v=${id}`
      : null;

  return {
    id,
    title: entry.title ?? 'Untitled',
    url,
    durationMs:
      typeof entry.duration === 'number' ? entry.duration * 1000 : null,
    thumbnail:
      pickThumbnail(entry) ??
      (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null),
    uploader: entry.uploader ?? entry.channel ?? null,
    isLive: entryIsLive(entry),
    stream: null,
    requestedById: null,
  };
}

function isLikelyPlaylistUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return false;
  }

  if (!/^https?:$/.test(parsed.protocol)) return false;

  const host = parsed.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return false;
  if (!['youtube.com', 'music.youtube.com', 'm.youtube.com'].includes(host)) {
    return false;
  }

  if (parsed.pathname === '/playlist') return true;

  const isSingleVideoPath =
    parsed.pathname.startsWith('/watch') ||
    parsed.pathname.startsWith('/shorts') ||
    parsed.pathname.startsWith('/live');

  return (
    !isSingleVideoPath &&
    parsed.searchParams.has('list') &&
    !parsed.searchParams.has('v')
  );
}

function isHttpUrl(input) {
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function resolveVideo(url) {
  const stdout = await runYtDlp([
    '--skip-download',
    '--no-playlist',
    '--dump-single-json',
    '-f',
    'bestaudio/best',
    url,
  ]);
  const info = parseJson(stdout);

  if (info._type === 'playlist') {
    throw new UserFacingError(
      'That link points to a playlist. Paste the playlist URL or a single song link.',
    );
  }

  if (info.is_live === true || info.live_status === 'is_live') {
    throw new UserFacingError('Live streams are not supported. Try another song.');
  }

  if (!info.url) {
    throw new UserFacingError('Could not find an audio stream for that video.');
  }

  return {
    id: info.id ?? null,
    title: info.title ?? 'Unknown title',
    url: info.webpage_url ?? url,
    durationMs:
      typeof info.duration === 'number' ? info.duration * 1000 : null,
    thumbnail: pickThumbnail(info),
    uploader: info.uploader ?? info.channel ?? null,
    isLive: false,
    stream: {
      url: info.url,
      headers: info.http_headers ?? null,
      expiresAt: Date.now() + STREAM_TTL_MS,
    },
    requestedById: null,
  };
}

async function search(query) {
  const stdout = await runYtDlp([
    '--skip-download',
    '--flat-playlist',
    '--dump-single-json',
    `ytsearch5:${query}`,
  ]);
  const info = parseJson(stdout);
  const entries = (info.entries ?? []).filter(isPlayableEntry);

  const candidate =
    entries.find((entry) => !entryIsLive(entry)) ?? entries[0] ?? null;

  if (!candidate) {
    throw new UserFacingError(`No YouTube results found for "${query}".`);
  }

  return resolveVideo(candidate.url ?? candidate.id);
}

export async function resolveInput(input) {
  const query = input.trim();

  if (isLikelyPlaylistUrl(query)) {
    return resolvePlaylist(query);
  }

  if (isHttpUrl(query)) {
    return { kind: 'track', tracks: [await resolveVideo(query)] };
  }

  return { kind: 'track', tracks: [await search(query)] };
}

async function resolvePlaylist(url) {
  const stdout = await runYtDlp([
    '--skip-download',
    '--flat-playlist',
    '--playlist-end',
    String(config.maxPlaylistItems + 1),
    '--dump-single-json',
    url,
  ]);
  const info = parseJson(stdout);

  if (info._type !== 'playlist' || !Array.isArray(info.entries)) {
    return { kind: 'track', tracks: [await resolveVideo(url)] };
  }

  const playable = info.entries.filter(isPlayableEntry);
  const tracks = playable
    .slice(0, config.maxPlaylistItems)
    .map(entryToTrack)
    .filter((track) => track.url);

  if (tracks.length === 0) {
    throw new UserFacingError('That playlist has no playable videos.');
  }

  const totalItems = Math.max(
    Number(info.playlist_count) || playable.length,
    playable.length,
  );

  return {
    kind: 'playlist',
    name: info.title ?? 'Playlist',
    tracks,
    totalItems,
    truncated: totalItems > tracks.length,
  };
}

export async function resolveStream(track) {
  if (track.stream && track.stream.expiresAt > Date.now()) {
    return track.stream;
  }

  if (track.isLive) {
    throw new UserFacingError('Live streams are not supported.');
  }

  const stdout = await runYtDlp([
    '--skip-download',
    '--no-playlist',
    '--dump-single-json',
    '-f',
    'bestaudio/best',
    track.url,
  ]);
  const info = parseJson(stdout);

  if (!info.url) {
    throw new UserFacingError('Could not find an audio stream for that video.');
  }

  track.stream = {
    url: info.url,
    headers: info.http_headers ?? track.stream?.headers ?? null,
    expiresAt: Date.now() + STREAM_TTL_MS,
  };

  if (!track.durationMs && typeof info.duration === 'number') {
    track.durationMs = info.duration * 1000;
  }

  if (!track.thumbnail) {
    track.thumbnail = pickThumbnail(info);
  }

  return track.stream;
}
