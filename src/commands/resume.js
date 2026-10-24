import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { UserFacingError } from '../errors.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Resume the paused song');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  if (!player.resume()) {
    throw new UserFacingError('Playback is not paused.');
  }

  await interaction.reply({
    content: '▶️ Resumed.',
    flags: MessageFlags.Ephemeral,
  });
}
