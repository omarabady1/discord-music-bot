import 'dotenv/config';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const projectRoot = path.resolve(
  fileURLToPath(new URL('..', import.meta.url)),
);

const executableSuffix = process.platform === 'win32' ? '.exe' : '';

export const localYtDlpPath = path.join(
  projectRoot,
  'bin',
  `yt-dlp${executableSuffix}`,
);

function firstExisting(candidates) {
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function bundledYtDlpPath() {
  try {
    return require('youtube-dl-exec/src/constants').YOUTUBE_DL_PATH;
  } catch {
    return null;
  }
}

function bundledFfmpegPath() {
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
}

export const ytdlpPath =
  firstExisting([
    process.env.YTDLP_PATH,
    localYtDlpPath,
    bundledYtDlpPath(),
  ]) ?? 'yt-dlp';

export const ffmpegPath =
  firstExisting([process.env.FFMPEG_PATH, bundledFfmpegPath()]) ?? 'ffmpeg';
