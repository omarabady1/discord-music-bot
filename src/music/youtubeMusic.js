import { config } from '../config.js';
import { logError } from '../logger.js';
import { parseTimestamp } from '../utils/time.js';

const SEARCH_ENDPOINT = 'https://music.youtube.com/youtubei/v1/search';
const CLIENT_VERSION = '1.20240101.00.00';
const REQUEST_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 100;
const MAX_RESULTS = 10;
const DURATION_PATTERN = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const POPULARITY_PATTERN = /^\d[\d.,]*\s*[KMB]?\s+(views|plays)$/i;
const KIND_LABELS = new Set([
  'Song',
  'Video',
  'Single',
  'Album',
  'EP',
  'Playlist',
]);

const cache = new Map();
const inFlight = new Map();
let warnedMissingKey = false;

function textOf(node) {
  if (!node) return '';
  if (typeof node.simpleText === 'string') return node.simpleText;
  if (!Array.isArray(node.runs)) return '';
  return node.runs.map((run) => run.text ?? '').join('');
}

function itemVideoId(node) {
  const titleText =
    node?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text;
  const fromTitle =
    titleText?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

  return (
    fromTitle ??
    node?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ??
    null
  );
}

function cardVideoId(node) {
  const fromTitle =
    node?.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
  if (fromTitle) return fromTitle;

  for (const button of node?.buttons ?? []) {
    const videoId =
      button?.buttonRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
    if (videoId) return videoId;
  }

  return null;
}

function buildResult({ title, videoId, meta, rank }) {
  const parts = meta
    .split('•')
    .map((part) => part.trim())
    .filter(Boolean);

  let durationMs = null;
  const artistParts = parts.filter((part) => {
    if (KIND_LABELS.has(part)) return false;
    if (POPULARITY_PATTERN.test(part)) return false;
    if (DURATION_PATTERN.test(part)) {
      durationMs = parseTimestamp(part);
      return false;
    }
    return true;
  });

  return {
    title,
    artist: artistParts.join(' • ') || null,
    durationMs,
    url: `https://music.youtube.com/watch?v=${videoId}`,
    rank,
  };
}

function collect(node, results, seen) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) collect(child, results, seen);
    return;
  }

  if (node.musicCardShelfRenderer) {
    const card = node.musicCardShelfRenderer;
    const videoId = cardVideoId(card);
    const title = textOf(card.title).trim();

    if (videoId && title && !seen.has(videoId)) {
      seen.add(videoId);
      results.push(
        buildResult({
          title,
          videoId,
          meta: textOf(card.subtitle),
          rank: 0,
        }),
      );
    }
  } else if (node.musicResponsiveListItemRenderer) {
    const item = node.musicResponsiveListItemRenderer;
    const videoId = itemVideoId(item);
    const columns = (item.flexColumns ?? []).map((column) =>
      textOf(column?.musicResponsiveListItemFlexColumnRenderer?.text).trim(),
    );
    const title = columns[0];

    if (videoId && title && !seen.has(videoId)) {
      const meta = columns.slice(1).filter(Boolean).join(' • ');
      const kind = meta.split('•')[0].trim();
      const rank = kind === 'Song' ? 1 : kind === 'Video' ? 2 : 3;

      seen.add(videoId);
      results.push(buildResult({ title, videoId, meta, rank }));
    }
  }

  for (const value of Object.values(node)) collect(value, results, seen);
}

function parseSearchResults(payload) {
  const results = [];
  collect(payload?.contents, results, new Set());

  return results
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_RESULTS)
    .map(({ rank, ...result }) => result);
}

async function requestSearch(query) {
  const url = `${SEARCH_ENDPOINT}?key=${encodeURIComponent(config.youtubeMusicApiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      origin: 'https://music.youtube.com',
      referer: 'https://music.youtube.com/',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: CLIENT_VERSION,
          hl: 'en',
          gl: 'US',
        },
      },
      query,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`YouTube Music returned HTTP ${response.status}.`);
  }

  return parseSearchResults(await response.json());
}

function normalizeQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function remember(query, results) {
  cache.set(query, {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  while (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

export async function searchYouTubeMusic(query, { limit = 8 } = {}) {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) return [];

  if (!config.youtubeMusicApiKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      logError(
        'YOUTUBE_MUSIC_API_KEY is missing. /search suggestions are disabled until it is set in .env.',
      );
    }
    return [];
  }

  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results.slice(0, limit);
  }
  cache.delete(normalized);

  let pending = inFlight.get(normalized);
  if (!pending) {
    pending = requestSearch(normalized)
      .then((results) => {
        remember(normalized, results);
        return results;
      })
      .catch((error) => {
        logError(
          `YouTube Music search failed for "${normalized}":`,
          error.message ?? error,
        );
        return [];
      })
      .finally(() => {
        inFlight.delete(normalized);
      });
    inFlight.set(normalized, pending);
  }

  const results = await pending;
  return results.slice(0, limit);
}
