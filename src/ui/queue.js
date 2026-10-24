import { EmbedBuilder } from 'discord.js';
import { formatDuration, truncate } from '../utils/time.js';

const COLOR = 0x9d4edd;

function durationLabel(track) {
  return track.durationMs ? formatDuration(track.durationMs) : 'Unknown';
}

export function buildQueueEmbed({ current, positionMs, paused, queue }) {
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
    const lines = queue.slice(0, 10).map((track, index) => {
      return `**${index + 1}.** [${truncate(track.title, 70)}](${track.url}) \`${durationLabel(track)}\``;
    });

    if (queue.length > 10) {
      lines.push(`…and **${queue.length - 10}** more`);
    }

    embed.setDescription(lines.join('\n'));
  }

  const remainingMs = queue.reduce(
    (total, track) => total + (track.durationMs ?? 0),
    0,
  );

  embed.setFooter({
    text: `${queue.length} upcoming • ${formatDuration(remainingMs)} remaining`,
  });

  if (current?.thumbnail) embed.setThumbnail(current.thumbnail);

  return embed;
}
