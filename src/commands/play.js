import { SlashCommandBuilder } from 'discord.js';
import { queueFromQuery } from './shared.js';

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
  await queueFromQuery(interaction, { players });
}
