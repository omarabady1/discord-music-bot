import { MessageFlags } from 'discord.js';
import { ensureController } from '../commands/shared.js';
import { UserFacingError } from '../errors.js';
import { logError } from '../logger.js';

const BUTTON_PREFIX = 'music:';

async function replyEphemeral(interaction, content) {
  const payload = { content, flags: MessageFlags.Ephemeral };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // The interaction may already be expired.
  }
}

export async function handleMusicButton(interaction, players) {
  if (!interaction.customId.startsWith(BUTTON_PREFIX)) return false;

  const player = players.get(interaction.guildId);
  if (!player) {
    await replyEphemeral(interaction, 'Nothing is playing right now.');
    return true;
  }

  try {
    ensureController(interaction, player);
  } catch (error) {
    await replyEphemeral(interaction, error.message);
    return true;
  }

  await interaction.deferUpdate().catch(() => {});

  try {
    switch (interaction.customId) {
      case 'music:toggle': {
        const state = player.togglePause();
        if (!state) {
          await replyEphemeral(interaction, 'Nothing is playing right now.');
        }
        break;
      }

      case 'music:previous':
        player.previous();
        break;

      case 'music:next':
        player.skip();
        break;

      case 'music:volume-down':
        player.adjustVolume(-10);
        break;

      case 'music:volume-up':
        player.adjustVolume(10);
        break;

      case 'music:back':
        player.seek(Math.max(0, player.positionMs - 10_000));
        break;

      case 'music:forward': {
        const duration = player.current?.durationMs;
        const target = player.positionMs + 10_000;
        player.seek(duration ? Math.min(target, duration - 1000) : target);
        break;
      }

      case 'music:stop':
        await player.stop('Stopped. I left the voice channel.');
        break;

      default:
        break;
    }
  } catch (error) {
    if (error instanceof UserFacingError) {
      await replyEphemeral(interaction, error.message);
    } else {
      logError('Music button failed:', error);
      await replyEphemeral(
        interaction,
        'Something went wrong. Check the bot console.',
      );
    }
  }

  return true;
}
