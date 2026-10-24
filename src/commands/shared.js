import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { UserFacingError } from '../errors.js';
import { resolveInput } from '../music/youtube.js';
import { formatDuration, truncate } from '../utils/time.js';

export function requireVoiceChannel(interaction) {
  const channel = interaction.member?.voice?.channel;

  if (!channel) {
    throw new UserFacingError('Join a voice channel first.');
  }

  if (channel.type === ChannelType.GuildStageVoice) {
    throw new UserFacingError(
      'Stage channels are not supported. Use a regular voice channel.',
    );
  }

  if (channel.type !== ChannelType.GuildVoice) {
    throw new UserFacingError('I can only play in regular voice channels.');
  }

  return channel;
}

export function requireBotVoicePermissions(interaction, voiceChannel) {
  const me = interaction.guild.members.me;
  const permissions = voiceChannel.permissionsFor(me);

  if (!permissions?.has(PermissionFlagsBits.Connect)) {
    throw new UserFacingError(
      `I need the Connect permission in <#${voiceChannel.id}>.`,
    );
  }

  if (!permissions.has(PermissionFlagsBits.Speak)) {
    throw new UserFacingError(
      `I need the Speak permission in <#${voiceChannel.id}>.`,
    );
  }
}

export function requireTextPermissions(interaction) {
  const permissions = interaction.channel?.permissionsFor(
    interaction.guild.members.me,
  );

  if (
    !permissions?.has(PermissionFlagsBits.SendMessages) ||
    !permissions.has(PermissionFlagsBits.EmbedLinks)
  ) {
    throw new UserFacingError(
      'I need Send Messages and Embed Links permissions in this channel.',
    );
  }
}

function queueConfirmation(result, next) {
  const prefix = next ? '⏭️' : '📥';
  const suffix = next ? ' to play next' : '';

  if (result.kind === 'playlist') {
    const name = truncate(result.name, 80);
    let content = `${prefix} Queued **${result.tracks.length}** tracks from **${name}**${suffix}.`;

    if (result.truncated) {
      content += `\nOnly the first ${result.tracks.length} of ${result.totalItems} tracks were added.`;
    }

    return content;
  }

  const track = result.tracks[0];
  const duration = track.durationMs
    ? ` \`${formatDuration(track.durationMs)}\``
    : '';

  return `${prefix} Queued **${truncate(track.title, 90)}**${duration}${suffix}.`;
}

export async function queueFromQuery(interaction, { players, next = false }) {
  const voiceChannel = requireVoiceChannel(interaction);
  requireBotVoicePermissions(interaction, voiceChannel);
  requireTextPermissions(interaction);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const query = interaction.options.getString('query', true);
  const result = await resolveInput(query);

  const player = await players.getOrCreate(interaction, voiceChannel);
  player.enqueue(result.tracks, { requestedBy: interaction.user, next });

  await interaction.editReply({ content: queueConfirmation(result, next) });
}

export function getPlayer(interaction, manager) {
  const player = manager.get(interaction.guildId);

  if (!player) {
    throw new UserFacingError("I'm not playing anything in this server.");
  }

  return player;
}

export function ensureController(interaction, player) {
  const channel = interaction.member?.voice?.channel;

  if (!channel || channel.id !== player.voiceChannelId) {
    throw new UserFacingError(
      `You need to be in <#${player.voiceChannelId}> to control the player.`,
    );
  }
}
