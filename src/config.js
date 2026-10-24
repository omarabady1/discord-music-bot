import 'dotenv/config';

const idleMinutes = Number.parseInt(
  process.env.IDLE_DISCONNECT_MINUTES ?? '5',
  10,
);

export const config = {
  token: process.env.DISCORD_TOKEN?.trim() ?? '',
  cookiesFile: process.env.YTDLP_COOKIES_FILE?.trim() || null,
  idleDisconnectMs:
    Number.isFinite(idleMinutes) && idleMinutes >= 0
      ? idleMinutes * 60_000
      : 5 * 60_000,
  maxPlaylistItems: 100,
};
