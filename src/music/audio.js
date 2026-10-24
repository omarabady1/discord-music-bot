import { spawn } from 'node:child_process';
import { logError } from '../logger.js';
import { ffmpegPath } from '../paths.js';

function formatHeaders(headers) {
  if (!headers) return null;
  const entries = Object.entries(headers).filter(
    ([key, value]) => key && value,
  );
  if (entries.length === 0) return null;
  return `${entries.map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n`;
}

export function createPcmStream({ url, headers, seekMs = 0 }) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-reconnect',
    '1',
    '-reconnect_streamed',
    '1',
    '-reconnect_delay_max',
    '5',
    '-rw_timeout',
    '15000000',
  ];

  const headerBlock = formatHeaders(headers);
  if (headerBlock) args.push('-headers', headerBlock);
  if (seekMs > 0) args.push('-ss', (seekMs / 1000).toFixed(3));

  args.push(
    '-i',
    url,
    '-vn',
    '-sn',
    '-dn',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-f',
    's16le',
    'pipe:1',
  );

  const process = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  let killed = false;

  process.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4000);
  });

  process.stdout.on('error', () => {});

  process.on('error', (error) => {
    logError('ffmpeg failed to start:', error);
    process.stdout.destroy();
  });

  process.on('close', (code) => {
    if (code && !killed) {
      logError(`ffmpeg exited with code ${code}:`, stderr.trim());
    }
  });

  const kill = () => {
    if (killed) return;
    killed = true;
    process.stdout.destroy();
    if (process.exitCode == null) process.kill('SIGKILL');
  };

  return { stream: process.stdout, process, kill };
}
