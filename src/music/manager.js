import { GuildPlayer } from './player.js';

export class PlayerManager {
  #players = new Map();

  constructor(client) {
    this.client = client;
  }

  get(guildId) {
    return this.#players.get(guildId) ?? null;
  }

  async getOrCreate(interaction, voiceChannel) {
    const guildId = interaction.guildId;
    let player = this.#players.get(guildId);

    if (!player) {
      player = new GuildPlayer({
        guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        client: this.client,
        onDestroy: () => this.#players.delete(guildId),
      });
      this.#players.set(guildId, player);
    }

    await player.connect(voiceChannel, interaction.channel);
    return player;
  }

  destroyAll() {
    for (const player of this.#players.values()) {
      void player.destroy('Bot shutting down.');
    }
    this.#players.clear();
  }
}
