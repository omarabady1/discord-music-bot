import { SlashCommandBuilder } from 'discord.js';
import { queueFromQuery } from './shared.js';

export const data = new SlashCommandBuilder()
  .setName('playnext')
  .setDescription('Queue a song or playlist to play next')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('YouTube / YouTube Music URL, playlist URL, or search terms')
      .setRequired(true),
  );

export async function execute(interaction, { players }) {
  await queueFromQuery(interaction, { players, next: true });
}
