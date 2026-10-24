import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('next')
  .setDescription('Skip to the next song');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  player.skip();

  await interaction.reply({
    content: '⏭️ Skipped.',
    flags: MessageFlags.Ephemeral,
  });
}
