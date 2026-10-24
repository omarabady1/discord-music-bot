import { execFile } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { chmod, mkdir, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import {
  ffmpegPath,
  localYtDlpPath,
  projectRoot,
  ytdlpPath,
} from '../src/paths.js';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const forceDownload = process.argv.includes('--force');

function ytDlpAssetName() {
  if (process.platform === 'win32') return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  if (process.platform === 'linux') {
    if (process.arch === 'arm64') return 'yt-dlp_linux_aarch64';
    if (process.arch === 'arm') return 'yt-dlp_linux_armv7l';
    return 'yt-dlp_linux';
  }
  return 'yt-dlp';
}

async function verify(binary, args) {
  try {
    const { stdout } = await execFileAsync(binary, args, {
      timeout: 60_000,
      windowsHide: true,
      encoding: 'utf8',
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function downloadYtDlp() {
  const asset = ytDlpAssetName();
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;

  console.log(`Downloading ${asset}...`);
  const response = await fetch(url, { redirect: 'follow' });

  if (!response.ok || !response.body) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }

  await mkdir(path.dirname(localYtDlpPath), { recursive: true });

  const tempPath = `${localYtDlpPath}.download`;
  await rm(tempPath, { force: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tempPath));
  await chmod(tempPath, 0o755);
  await rename(tempPath, localYtDlpPath);
}

function bundledFfmpeg() {
  try {
    return require('ffmpeg-static');
  } catch {
    return null;
  }
}

async function installFfmpeg() {
  const installer = path.join(
    projectRoot,
    'node_modules',
    'ffmpeg-static',
    'install.js',
  );

  if (!existsSync(installer)) {
    throw new Error('ffmpeg-static is not installed. Run npm install first.');
  }

  console.log('Downloading the bundled ffmpeg build...');
  await execFileAsync(process.execPath, [installer], {
    timeout: 300_000,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function resolveYtDlp() {
  if (!forceDownload) {
    const version = await verify(ytdlpPath, ['--version']);
    if (version) return { binary: ytdlpPath, version: version.split('\n')[0] };
  }

  await downloadYtDlp();
  const version = await verify(localYtDlpPath, ['--version']);

  if (!version) throw new Error('The downloaded yt-dlp binary did not run.');
  return { binary: localYtDlpPath, version: version.split('\n')[0] };
}

async function resolveFfmpeg() {
  const version = await verify(ffmpegPath, ['-version']);
  if (version) return { binary: ffmpegPath, version: version.split('\n')[0] };

  await installFfmpeg();

  const refreshed = bundledFfmpeg();
  if (!refreshed) throw new Error('ffmpeg-static is not available.');

  const installedVersion = await verify(refreshed, ['-version']);
  if (!installedVersion) {
    throw new Error('The bundled ffmpeg binary did not run.');
  }

  return { binary: refreshed, version: installedVersion.split('\n')[0] };
}

try {
  const ytDlp = await resolveYtDlp();
  console.log(`yt-dlp: ${ytDlp.version}`);
  console.log(`        ${ytDlp.binary}`);

  const ffmpeg = await resolveFfmpeg();
  console.log(`ffmpeg: ${ffmpeg.version}`);
  console.log(`        ${ffmpeg.binary}`);

  console.log('\nAll media dependencies are ready.');
} catch (error) {
  console.error(`\nSetup failed: ${error.message}`);
  console.error(
    'Install yt-dlp and ffmpeg yourself, then set YTDLP_PATH and FFMPEG_PATH in .env.',
  );
  process.exit(1);
}
