import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import { loadCommands } from './commands/index.js';
import { config } from './config.js';
import { UserFacingError } from './errors.js';
import { log, logError } from './logger.js';
import { PlayerManager } from './music/manager.js';
import { preflight } from './preflight.js';
import { handleMusicButton } from './ui/controls.js';

const INVITE_PERMISSIONS = '3165184';

if (!config.token) {
  logError(
    'DISCORD_TOKEN is missing. Copy .env.example to .env and add your bot token.',
  );
  process.exit(1);
}

try {
  await preflight();
} catch (error) {
  logError(error.message);
  process.exit(1);
}

const commands = await loadCommands();
const commandPayload = [...commands.values()].map((command) =>
  command.data.toJSON(),
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const players = new PlayerManager(client);

async function registerGuildCommands(guild) {
  await guild.commands.set(commandPayload);
  log(`Registered ${commandPayload.length} commands in ${guild.name}.`);
}

async function reportCommandError(interaction, error) {
  const message =
    error instanceof UserFacingError
      ? error.message
      : 'Something went wrong. Check the bot console.';

  if (!(error instanceof UserFacingError)) {
    logError(`Command /${interaction.commandName} failed:`, error);
  }

  const payload = {
    content: `⚠️ ${message}`,
    embeds: [],
    components: [],
  };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    logError('Could not report the command error:', replyError);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  log(`Logged in as ${readyClient.user.tag}.`);

  for (const guild of readyClient.guilds.cache.values()) {
    await registerGuildCommands(guild).catch((error) => {
      logError(`Could not register commands in ${guild.name}:`, error);
    });
  }

  if (readyClient.guilds.cache.size === 0) {
    const inviteUrl =
      `https://discord.com/oauth2/authorize?client_id=${readyClient.user.id}` +
      `&permissions=${INVITE_PERMISSIONS}&scope=bot%20applications.commands`;
    log(`No servers yet. Invite the bot with: ${inviteUrl}`);
  }
});

client.on(Events.GuildCreate, (guild) => {
  registerGuildCommands(guild).catch((error) => {
    logError(`Could not register commands in ${guild.name}:`, error);
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = commands.get(interaction.commandName);
    if (!command?.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      logError(`Autocomplete /${interaction.commandName} failed:`, error);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }

  if (interaction.isButton()) {
    await handleMusicButton(interaction, players);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { players, client });
  } catch (error) {
    await reportCommandError(interaction, error);
  }
});

client.on(Events.Error, (error) => {
  logError('Discord client error:', error);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection:', reason);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log(`Received ${signal}. Shutting down.`);
    players.destroyAll();
    client.destroy();
    process.exit(0);
  });
}

try {
  await client.login(config.token);
} catch (error) {
  logError('Discord login failed:', error.message ?? error);
  process.exit(1);
}
