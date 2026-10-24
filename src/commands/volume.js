import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { ensureController, getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Show or change the playback volume')
  .addIntegerOption((option) =>
    option
      .setName('level')
      .setDescription('Volume from 0 to 100 (omit to see the current volume)')
      .setMinValue(0)
      .setMaxValue(100)
      .setRequired(false),
  );

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);
  ensureController(interaction, player);

  const level = interaction.options.getInteger('level');

  if (level == null) {
    await interaction.reply({
      content: `🔊 Volume is ${player.volumePercent}%.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const applied = player.setVolume(level);

  await interaction.reply({
    content: `🔊 Volume set to ${applied}%.`,
    flags: MessageFlags.Ephemeral,
  });
}
