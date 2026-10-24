import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { buildQueueEmbed } from '../ui/queue.js';
import { getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current song and the upcoming queue')
  .addIntegerOption((option) =>
    option
      .setName('page')
      .setDescription('Queue page (10 songs per page)')
      .setMinValue(1)
      .setRequired(false),
  );

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  const page = interaction.options.getInteger('page') ?? 1;

  const embed = buildQueueEmbed({
    current: player.current,
    positionMs: player.positionMs,
    paused: player.isPaused,
    queue: player.queue,
    page,
  });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}
