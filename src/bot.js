/**
 *  ChadMusic - The Chad Music Bot
 *  Copyright (C) 2022  Micky D. | @200percentmicky | Micky-kun#3836
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

'use strict';

const logger = require('./modules/winstonLogger');

// Say hello!
const { version } = require('../package.json');
logger.info('   ________              ____  ___           _');
logger.info('  / ____/ /_  ____ _____/ /  |/  /_  _______(_)____');
logger.info(' / /   / __ \\/ __ `/ __  / /|_/ / / / / ___/ / ___/');
logger.info('/ /___/ / / / /_/ / /_/ / /  / / /_/ (__  ) / /__');
logger.info('\\____/_/ /_/\\__,_/\\__,_/_/  /_/\\__,_/____/_/\\___/');
logger.info('/////////////// The Chad Music Bot! ///////////////');
logger.info('Created by Micky D. | @200percentmicky | Micky-kun#3836');
logger.info('Bot Version: %s', version);
logger.info('Loading libraries...');

const { AkairoClient, CommandHandler, ListenerHandler, InhibitorHandler } = require('discord-akairo');
const { ChannelType, GatewayIntentBits } = require('discord.js');
const { SlashCreator, GatewayServer } = require('slash-create');
const DisTube = require('../chadtube/dist').default;
const { SpotifyPlugin } = require('@distube/spotify');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const Keyv = require('keyv');
const Enmap = require('enmap');
const ui = require('./modules/WaveUI');
const path = require('path');

// Let's boogie!
class WaveBot extends AkairoClient {
    constructor () {
        super({
            ownerID: process.env.OWNER_ID
        }, {
            allowedMentions: {
                repliedUser: false
            },
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent
            ]
        });

        // Calling packages that can be used throughout the client.
        this.logger = logger;
        this.ui = ui;
        this.utils = require('bot-utils');

        // Music Player.
        this.player = new DisTube(this, {
            plugins: [
                new SpotifyPlugin({
                    emitEventsAfterFetching: true,
                    parallel: false
                }),
                new YtDlpPlugin({ update: true })
            ],
            emitNewSongOnly: process.env.EMIT_NEW_SONG_ONLY === 'true' || false,
            leaveOnStop: process.env.LEAVE_ON_STOP === 'true' || false,
            leaveOnEmpty: process.env.LEAVE_ON_EMPTY === 'true' || false,
            leaveOnFinish: process.env.LEAVE_ON_FINISH === 'true' || false,
            youtubeCookie: process.env.YOUTUBE_COOKIE,
            ytdlOptions: {
                quality: 'highestaudio',
                filter: 'audioonly',
                dlChunkSize: 25000,
                highWaterMark: 1024
            },
            nsfw: true // Being handled on a per guild basis, not client-wide.
        });
        this.vc = this.player.voices; // @discordjs/voice

        this.settings = new Enmap({ name: 'settings' });
        this.tags = new Enmap({ name: 'tags' });

        this.depWarnMsg = new Keyv();

        this.defaultSettings = {
            prefix: process.env.PREFIX,
            djRole: null,
            djMode: false,
            maxTime: null,
            maxQueueLimit: null,
            allowFilters: true,
            allowAgeRestricted: true,
            allowFreeVolume: true,
            allowLinks: true,
            allowSilent: true,
            defaultVolume: 100,
            textChannel: null,
            blockedPhrases: [],
            thumbnailSize: 'small'
        };

        // Create Command Handler
        this.commands = new CommandHandler(this, {
            directory: './src/commands',
            prefix: message => {
                // This is an attempt to have custom prefixes, despite how Enmap likes to complain.
                // If no key is found, this should return the configured prefix in the .env file.
                if (message.channel.type === ChannelType.DM) {
                    return process.env.PREFIX;
                } else {
                    this.settings.ensure(message.guild.id, this.defaultSettings); // Hoping that the bot doesn't have a panic attack.
                    try {
                        return [this.settings.get(message.guild.id, 'prefix'), process.env.PREFIX] ?? process.env.PREFIX;
                    } catch {
                        return process.env.PREFIX;
                    }
                }
            },
            commandUtil: true,
            handleEdits: true,
            allowMention: true
        });

        // Create Listener Handler
        this.listeners = new ListenerHandler(this, {
            directory: './src/listeners'
        });

        // Create Inhibitor Handler
        this.inhibitors = new InhibitorHandler(this, {
            directory: './src/inhibitors'
        });

        this.creator = new SlashCreator({
            token: process.env.TOKEN,
            applicationID: process.env.APP_ID,
            publicKey: process.env.PUBLIC_KEY,
            client: this,
            disableTimeouts: true,
            unknownCommandResponse: false
        });

        // Gateway Server
        this.creator.withServer(
            new GatewayServer(
                (handler) => this.ws.on('INTERACTION_CREATE', handler)
            )
        );

        // Register commands in the "commands" directory.
        this.creator.registerCommandsIn(path.join(__dirname, 'appcommands'));
        this.creator.syncCommands({ // Sync all commands with Discord.
            deleteCommands: process.env.DELETE_INVALID_COMMANDS === 'true' || false,
            skipGuildErrors: true,
            syncGuilds: true,
            syncPermissions: true
        });

        // Set custom emitters
        this.listeners.setEmitters({
            process: process,
            commandHandler: this.commands,
            player: this.player,
            creator: this.creator
        });

        this.commands.useInhibitorHandler(this.inhibitors); // Use all Inhibitors.
        this.commands.useListenerHandler(this.listeners); // Use all Listeners.

        this.commands.loadAll(); // Load all Inhibitors
        this.listeners.loadAll(); // Load all Listeners.

        // In the case of production, load all Inhibitors.
        if (process.env.DEV === 'true') {
            this.inhibitors.loadAll();
        }
    }

    // This is required to load the mongoose provider.
    async login (token) {
        return super.login(token);
    }
}

module.exports = WaveBot;
