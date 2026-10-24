import {
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { resolveInput } from '../music/youtube.js';
import { formatDuration, truncate } from '../utils/time.js';
import {
  requireBotVoicePermissions,
  requireTextPermissions,
  requireVoiceChannel,
} from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a YouTube song or playlist in your voice channel')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('YouTube / YouTube Music URL, playlist URL, or search terms')
      .setRequired(true),
  );

export async function execute(interaction, { players }) {
  const voiceChannel = requireVoiceChannel(interaction);
  requireBotVoicePermissions(interaction, voiceChannel);
  requireTextPermissions(interaction);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const query = interaction.options.getString('query', true);
  const result = await resolveInput(query);

  const player = await players.getOrCreate(interaction, voiceChannel);
  player.enqueue(result.tracks, { requestedBy: interaction.user });

  let content;
  if (result.kind === 'playlist') {
    content = `📥 Queued **${result.tracks.length}** tracks from **${truncate(result.name, 80)}**.`;
    if (result.truncated) {
      content += `\nOnly the first ${result.tracks.length} of ${result.totalItems} tracks were added.`;
    }
  } else {
    const track = result.tracks[0];
    const duration = track.durationMs
      ? ` \`${formatDuration(track.durationMs)}\``
      : '';
    content = `📥 Queued **${truncate(track.title, 90)}**${duration}.`;
  }

  await interaction.editReply({ content });
}
