import { EmbedBuilder } from 'discord.js';
import { formatDuration, truncate } from '../utils/time.js';

const COLOR = 0x9d4edd;
const PAGE_SIZE = 10;

function durationLabel(track) {
  return track.durationMs ? formatDuration(track.durationMs) : 'Unknown';
}

export function buildQueueEmbed({
  current,
  positionMs,
  paused,
  queue,
  page = 1,
}) {
  const totalPages = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
  const requestedPage = Number.isFinite(page) ? Math.trunc(page) : 1;
  const safePage = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageTracks = queue.slice(start, start + PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('Music queue');

  if (current) {
    const status = paused ? '⏸️' : '▶️';
    embed.addFields({
      name: 'Now playing',
      value: `${status} [${truncate(current.title, 80)}](${current.url}) \`${formatDuration(positionMs)} / ${durationLabel(current)}\``,
    });
  }

  if (queue.length === 0) {
    embed.setDescription('The queue is empty. Use `/play` to add songs.');
  } else {
    const lines = pageTracks.map((track, index) => {
      const position = start + index + 1;
      return `**${position}.** [${truncate(track.title, 70)}](${track.url}) \`${durationLabel(track)}\``;
    });

    embed.setDescription(lines.join('\n'));
  }

  const remainingMs = queue.reduce(
    (total, track) => total + (track.durationMs ?? 0),
    0,
  );
  const pageLabel = totalPages > 1 ? `Page ${safePage}/${totalPages} • ` : '';

  embed.setFooter({
    text: `${pageLabel}${queue.length} upcoming • ${formatDuration(remainingMs)} remaining`,
  });

  if (current?.thumbnail) embed.setThumbnail(current.thumbnail);

  return embed;
}
