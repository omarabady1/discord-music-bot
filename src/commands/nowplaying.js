import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { UserFacingError } from '../errors.js';
import { buildNowPlayingEmbed } from '../ui/nowPlaying.js';
import { getPlayer } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show details about the current song');

export async function execute(interaction, { players }) {
  const player = getPlayer(interaction, players);

  if (!player.current) {
    throw new UserFacingError('Nothing is playing right now.');
  }

  const embed = buildNowPlayingEmbed({
    track: player.current,
    positionMs: player.positionMs,
    paused: player.isPaused,
    queue: player.queue,
  });

  await interaction.reply({
    embeds: [embed],
    flags: MessageFlags.Ephemeral,
  });
}
