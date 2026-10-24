import { SlashCommandBuilder } from 'discord.js';
import { searchYouTubeMusic } from '../music/youtubeMusic.js';
import { formatDuration, truncate } from '../utils/time.js';
import { queueFromQuery } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search YouTube Music and play the selected song')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('Song or artist to search for')
      .setRequired(true)
      .setAutocomplete(true),
  );

function choiceName(result) {
  const duration = result.durationMs ? formatDuration(result.durationMs) : null;

  return truncate(
    [result.title, result.artist, duration].filter(Boolean).join(' • '),
    100,
  );
}

export async function autocomplete(interaction) {
  const query = interaction.options.getFocused().trim();

  if (query.length < 2) {
    await interaction.respond([]);
    return;
  }

  const results = await searchYouTubeMusic(query, { limit: 8 });

  await interaction.respond(
    results.map((result) => ({
      name: choiceName(result),
      value: result.url,
    })),
  );
}

export async function execute(interaction, { players }) {
  await queueFromQuery(interaction, { players });
}
