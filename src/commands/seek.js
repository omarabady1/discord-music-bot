import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { UserFacingError } from '../errors.js';
import { formatDuration, parseTimestamp } from '../utils/time.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Jump to a position in the current song')
  .addStringOption((option) =>
    option
      .setName('time')
      .setDescription('Position: 90, 1:30, or 1:02:03')
      .setRequired(true),
  );

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  if (!player.current) {
    throw new UserFacingError('Nothing is playing right now.');
  }

  if (player.current.isLive) {
    throw new UserFacingError('Live streams cannot be seeked.');
  }

  const input = interaction.options.getString('time', true);
  const targetMs = parseTimestamp(input);

  if (targetMs == null) {
    throw new UserFacingError('Use seconds (`90`), `mm:ss`, or `hh:mm:ss`.');
  }

  if (player.current.durationMs && targetMs > player.current.durationMs) {
    throw new UserFacingError(
      `That song is only ${formatDuration(player.current.durationMs)} long.`,
    );
  }

  const applied = player.seek(targetMs);

  await interaction.reply({
    content: `⏩ Seeked to \`${formatDuration(applied)}\`.`,
    flags: MessageFlags.Ephemeral,
  });
}
