import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../src/config.js';
import { createPcmStream } from '../src/music/audio.js';
import { resolveInput, resolveStream } from '../src/music/youtube.js';
import { ffmpegPath, ytdlpPath } from '../src/paths.js';

const execFileAsync = promisify(execFile);
const TEST_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const BYTES_NEEDED = 48000 * 2 * 2 * 0.5;

async function version(binary, args) {
  const { stdout } = await execFileAsync(binary, args, {
    timeout: 60_000,
    windowsHide: true,
    encoding: 'utf8',
  });
  return stdout.trim().split('\n')[0];
}

async function readAudio(streamInfo) {
  const pcm = createPcmStream({
    url: streamInfo.url,
    headers: streamInfo.headers,
    seekMs: 5000,
  });

  return new Promise((resolve, reject) => {
    let bytes = 0;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pcm.kill();
      if (error) reject(error);
      else resolve(bytes);
    };

    const timer = setTimeout(() => {
      finish(new Error('Timed out waiting for audio data from ffmpeg.'));
    }, 30_000);

    pcm.stream.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes >= BYTES_NEEDED) finish();
    });

    pcm.stream.on('error', (error) => finish(error));

    pcm.process.on('close', () => {
      if (bytes < BYTES_NEEDED) {
        finish(
          new Error(
            'ffmpeg stopped before producing enough audio. The stream URL may have expired.',
          ),
        );
      }
    });
  });
}

try {
  console.log(`yt-dlp: ${await version(ytdlpPath, ['--version'])}`);
  console.log(`ffmpeg: ${await version(ffmpegPath, ['-version'])}`);
  if (config.cookiesFile) {
    console.log(`cookies: ${config.cookiesFile}`);
  }

  console.log('\nExtracting a test video...');
  const result = await resolveInput(TEST_URL);
  const track = result.tracks[0];
  console.log(`Title:    ${track.title}`);
  console.log(`Duration: ${Math.round((track.durationMs ?? 0) / 1000)}s`);

  console.log('\nRequesting the audio stream...');
  const streamInfo = await resolveStream(track);

  console.log('Decoding 0.5s of PCM starting at 0:05...');
  const bytes = await readAudio(streamInfo);

  console.log(`Received ${bytes} bytes of PCM audio.`);
  console.log('\nEverything works. Start the bot with: npm start');
} catch (error) {
  console.error(`\nCheck failed: ${error.message}`);
  console.error(
    'Run npm run setup. If generation fails, see the cookies section in the README.',
  );
  process.exit(1);
}
