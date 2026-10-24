import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { truncate } from '../utils/time.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a song from the upcoming queue')
  .addIntegerOption((option) =>
    option
      .setName('position')
      .setDescription('Queue position from /queue (1 = next song)')
      .setMinValue(1)
      .setRequired(true),
  );

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  const position = interaction.options.getInteger('position', true);
  const removed = player.removeUpcoming(position);

  await interaction.reply({
    content: `🗑️ Removed **${truncate(removed.title, 90)}** from the queue.`,
    flags: MessageFlags.Ephemeral,
  });
}
