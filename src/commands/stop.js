import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback, clear the queue, and leave the voice channel');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  await interaction.reply({
    content: '⏹️ Stopped and left the voice channel.',
    flags: MessageFlags.Ephemeral,
  });

  await player.stop('Stopped. I left the voice channel.');
}
