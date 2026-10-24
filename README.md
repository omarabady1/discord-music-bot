# Discord Music Bot

A Discord bot that plays YouTube and YouTube Music songs and playlists in your
voice channel. It has pause/resume, seek, volume, next, previous, queue, and
now-playing controls, both as slash commands and as buttons on the player
message.

The media pipeline uses `yt-dlp` for YouTube extraction and `ffmpeg` for
decoding. Both binaries are downloaded automatically during setup, so you do
not need to install them manually.

## Features

- `/play` accepts a YouTube song URL, YouTube Music URL, playlist URL, or search
  terms.
- `/search` searches YouTube Music and shows matching songs while you type;
  pick one from the list to play it.
- `/playnext` adds a song or playlist to the front of the queue, so it plays
  after the current track instead of at the end.
- `/queue` pages through the upcoming queue, 10 songs at a time.
- `/remove` removes an upcoming song by its queue position.
- Playlists are queued in order (up to 100 tracks per playlist link).
- Buttons: Previous, Pause/Resume, Next, -10s, +10s, Stop, Vol -10%, Vol +10%.
- Slash commands work alongside the buttons.
- Playback starts at 15% volume. Volume can be changed from 0% to 100% with
  `/volume` or the volume buttons.
- Previous restarts the current song when it has been playing for more than 3
  seconds; otherwise it goes back to the previous song.
- Seeking restarts the audio stream at the requested position, so it works for
  songs of any length.
- The bot leaves the voice channel after 5 minutes of inactivity (configurable).
- Commands are registered automatically in every server the bot joins.

## Requirements

- Node.js 20 or newer.
- A Discord bot application (free).
- Internet access.

Windows, macOS, and Linux are supported.

## 1. Install the project

Open a terminal in this folder and run:

```bash
npm install
npm run setup
```

`npm run setup` downloads `yt-dlp` if needed and installs the bundled `ffmpeg`
build. It is safe to run more than once.

Optionally verify that extraction and decoding work end to end:

```bash
npm run check
```

## 2. Create the Discord bot

1. Open <https://discord.com/developers/applications> and click **New
   Application**. Give it any name.
2. Open the **Bot** tab and click **Reset Token**, then **Copy**. This token is
   the password for your bot. Do not share it or commit it.
3. You do not need to enable any privileged intents.
4. Open **OAuth2 > URL Generator** and select:
   - Scopes: `bot` and `applications.commands`
   - Bot permissions: **View Channels**, **Send Messages**, **Embed Links**,
     **Connect**, **Speak**
5. Open the generated URL, choose your server, and authorize the bot.

You can also use this URL after replacing `YOUR_CLIENT_ID` with the Application
ID from the **General Information** tab:

```text
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=3165184&scope=bot%20applications.commands
```

## 3. Configure the token

Copy the example environment file:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS / Linux
cp .env.example .env
```

Open `.env` and paste the token:

```env
DISCORD_TOKEN=your-bot-token-here
```

Settings:

| Variable | Purpose |
| --- | --- |
| `YOUTUBE_MUSIC_API_KEY` | Public API key used by the YouTube Music web player. Required for `/search` suggestions. |
| `YTDLP_COOKIES_FILE` | Path to a cookies file for age-restricted or bot-checked videos. |
| `IDLE_DISCONNECT_MINUTES` | Minutes before leaving an idle voice channel. Default `5`; `0` disables. |
| `YTDLP_PATH` | Override the `yt-dlp` binary path. |
| `FFMPEG_PATH` | Override the `ffmpeg` binary path. |

## 4. Start the bot

```bash
npm start
```

Keep this terminal open while you use the bot. Slash commands appear
immediately in every server the bot is in. The console prints an invite link if
the bot has not joined a server yet.

## Usage

Join a voice channel, then run:

| Command | What it does |
| --- | --- |
| `/play query:<song, URL, or playlist>` | Joins your voice channel and starts playing. |
| `/search query:<song or artist>` | Searches YouTube Music with live suggestions; the selected song plays like `/play`. |
| `/playnext query:<song, URL, or playlist>` | Adds it to the front of the queue, after the current song. |
| `/pause` / `/resume` | Pauses or resumes the current song. |
| `/next` | Skips to the next song. |
| `/previous` | Restarts the current song or plays the previous one. |
| `/seek time:<90, 1:30, or 1:02:03>` | Jumps to a position in the current song. |
| `/volume level:<0-100>` | Sets the volume. Omit `level` to see the current volume. |
| `/queue page:<number>` | Shows the queue, 10 upcoming songs per page. |
| `/remove position:<number>` | Removes an upcoming song by its queue number. Requires you to be in the bot's voice channel. |
| `/nowplaying` | Shows details about the current song. |
| `/stop` | Stops playback, clears the queue, and leaves the voice channel. |

The player message that appears in the text channel also has buttons for all
playback controls and volume. You must be in the same voice channel as the bot
to use them. The volume is shown in the player message footer.

Search examples:

```text
/play query:daft punk instant crush
/search query:daft punk instant crush
/playnext query:daft punk instant crush
/play query:https://www.youtube.com/watch?v=5NV6Rdv1a3I
/play query:https://music.youtube.com/watch?v=5NV6Rdv1a3I
/play query:https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI
```

## Age-restricted or blocked videos

YouTube sometimes requires a signed-in session. If you see **"YouTube wants a
signed-in session"** or **"Sign in to confirm you're not a bot"**, add cookies:

1. Log into YouTube in your browser.
2. Install a cookies export extension such as **Get cookies.txt LOCALLY**.
3. Export cookies for `youtube.com` and save the file as `cookies.txt` in a
   private location. Do not commit it to Git.
4. Add the absolute path to `.env`:

   ```env
   YTDLP_COOKIES_FILE=C:\path\to\cookies.txt
   ```

5. Restart the bot.

The cookies give the bot access to your YouTube account. Use a throwaway
account if you are not comfortable with that.

## Troubleshooting

**Slash commands do not appear**

- Make sure the bot was invited with the `applications.commands` scope. Re-invite
  it with the URL in step 2 if needed.
- Restart the bot and the Discord client. Guild commands are normally instant.

**The bot joins but there is no audio**

- Check that the bot has **Connect** and **Speak** in that voice channel.
- Check the terminal for `ffmpeg` or `yt-dlp` errors.

**YouTube stops working after a while**

YouTube changes its internals regularly. Update the bundled downloader:

```bash
npm run update-binaries
```

Then restart the bot.

**"Live streams are not supported"**

Live streams cannot be seeked, so they are rejected. Use normal songs or
premieres.

**"Could not join the voice channel"**

The channel may be full, or the bot may lack **Connect**/**Speak** permissions.

**A playlist is only partially added**

Playlist imports are capped at the first 100 playable tracks per link. Paste
the playlist again or play another playlist to add more.

## Keeping it running

The bot must stay running to play music. It only makes outbound connections, so
you do not need to open any ports. You can run it on your PC, a Raspberry Pi, or
a small VPS.

For a always-on setup on a server, a process manager is convenient:

```bash
npm install -g pm2
pm2 start src/index.js --name discord-music-bot
pm2 save
```

## Project structure

```text
src/
  index.js            Discord client, command registration, interaction routing
  commands/           One file per slash command
  music/
    player.js         Per-guild queue, playback state, controls, messages
    manager.js        Guild player registry
    youtube.js        yt-dlp extraction, search, playlists
    audio.js          ffmpeg PCM stream
  ui/                 Player embeds, buttons, queue view
scripts/
  setup.js            Downloads/verifies yt-dlp and ffmpeg
  check.js            End-to-end extraction and decoding test
```
