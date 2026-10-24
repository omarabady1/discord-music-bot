import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ffmpegPath, ytdlpPath } from './paths.js';

const execFileAsync = promisify(execFile);

async function verify(name, binary, args) {
  try {
    await execFileAsync(binary, args, {
      timeout: 30_000,
      windowsHide: true,
      encoding: 'utf8',
    });
  } catch (error) {
    const detail =
      error.code === 'ENOENT'
        ? `${name} was not found`
        : `${name} is not working (${error.message.split('\n')[0]})`;

    throw new Error(`${detail}. Run "npm run setup" and start the bot again.`);
  }
}

export async function preflight() {
  await verify('yt-dlp', ytdlpPath, ['--version']);
  await verify('ffmpeg', ffmpegPath, ['-version']);
}
