import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { UserFacingError } from '../errors.js';

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
