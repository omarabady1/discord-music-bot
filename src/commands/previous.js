import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { truncate } from '../utils/time.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('previous')
  .setDescription('Play the previous song, or restart the current one');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  const { track, restarted } = player.previous();
  const action = restarted ? 'Restarted' : 'Playing';

  await interaction.reply({
    content: `⏮️ ${action} **${truncate(track.title, 90)}**.`,
    flags: MessageFlags.Ephemeral,
  });
}
