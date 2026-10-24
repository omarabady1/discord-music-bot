import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { formatDuration, truncate } from '../utils/time.js';

const COLOR_PLAYING = 0x9d4edd;
const COLOR_PAUSED = 0xfaa61a;
const COLOR_IDLE = 0x4f545c;

function buildProgressBar(positionMs, durationMs, length = 14) {
  if (!durationMs || durationMs <= 0) return null;

  const ratio = Math.min(Math.max(positionMs / durationMs, 0), 1);
  const index = Math.min(length - 1, Math.round(ratio * (length - 1)));

  return `${'▬'.repeat(index)}🔘${'▬'.repeat(length - 1 - index)}`;
}

function durationLabel(track) {
  return track.durationMs ? formatDuration(track.durationMs) : 'Unknown';
}

export function buildNowPlayingEmbed({ track, positionMs, paused, queue }) {
  const bar = buildProgressBar(positionMs, track.durationMs);
  const status = paused ? '⏸️ Paused' : '▶️ Playing';
  const progress = bar
    ? `${status}  \`${formatDuration(positionMs)}\` ${bar} \`${durationLabel(track)}\``
    : `${status}  \`${formatDuration(positionMs)}\` • Unknown length`;

  const embed = new EmbedBuilder()
    .setColor(paused ? COLOR_PAUSED : COLOR_PLAYING)
    .setTitle(truncate(track.title, 100))
    .setURL(track.url)
    .setDescription(progress)
    .setFooter({
      text: `Queue: ${queue.length} track${queue.length === 1 ? '' : 's'}`,
    });

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);

  if (track.requestedById) {
    embed.addFields({
      name: 'Requested by',
      value: `<@${track.requestedById}>`,
      inline: true,
    });
  }

  embed.addFields({
    name: 'Up next',
    value: queue[0]
      ? `[${truncate(queue[0].title, 60)}](${queue[0].url})`
      : 'Nothing queued',
    inline: true,
  });

  return embed;
}

export function buildPlayerPayload({ track, positionMs, paused, queue }) {
  const embed = buildNowPlayingEmbed({ track, positionMs, paused, queue });

  const rowOne = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:previous')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:toggle')
      .setLabel(paused ? 'Resume' : 'Pause')
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music:next')
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary),
  );

  const rowTwo = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:back')
      .setLabel('-10s')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:forward')
      .setLabel('+10s')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:stop')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [rowOne, rowTwo] };
}

export function buildIdlePayload(message) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLOR_IDLE)
        .setTitle('Nothing playing')
        .setDescription(message),
    ],
    components: [],
  };
}
