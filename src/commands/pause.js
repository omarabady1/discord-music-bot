import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { UserFacingError } from '../errors.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause the current song');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  if (!player.pause()) {
    throw new UserFacingError('Nothing is playing right now.');
  }

  await interaction.reply({
    content: '⏸️ Paused.',
    flags: MessageFlags.Ephemeral,
  });
}
