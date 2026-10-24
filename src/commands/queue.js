import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { buildQueueEmbed } from '../ui/queue.js';
import { getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current song and the upcoming queue');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);

  const embed = buildQueueEmbed({
    current: player.current,
    positionMs: player.positionMs,
    paused: player.isPaused,
    queue: player.queue,
  });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}
