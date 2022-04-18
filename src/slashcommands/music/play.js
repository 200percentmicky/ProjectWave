const { SlashCommand, CommandOptionType } = require('slash-create');
const { Permissions } = require('discord.js');

const pornPattern = (url) => {
    // ! TODO: Come up with a better regex lol
    // eslint-disable-next-line no-useless-escape
    const pornPattern = /https?:\/\/(www\.)?(pornhub|xhamster|xvideos|porntube|xtube|youporn|pornerbros|pornhd|pornotube|pornovoisines|pornoxo)\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/g;
    const pornRegex = new RegExp(pornPattern);
    return url.match(pornRegex);
};

class CommandPlay extends SlashCommand {
    constructor (creator) {
        super(creator, {
            name: 'play',
            description: 'Plays a song by URL, an attachment, or from a search result.',
            options: [
                {
                    type: CommandOptionType.SUB_COMMAND,
                    name: 'track',
                    description: 'Plays a song by a search term or URL.',
                    options: [{
                        type: CommandOptionType.STRING,
                        name: 'query',
                        description: 'The track to play.',
                        required: true
                    }]
                },
                {
                    type: CommandOptionType.SUB_COMMAND,
                    name: 'attachment',
                    description: 'Plays a song from an attachment.',
                    options: [{
                        type: CommandOptionType.ATTACHMENT,
                        name: 'file',
                        description: 'The file to play. Supports both audio and video files.',
                        required: true
                    }]
                }
            ]
        });

        this.filePath = __filename;
    }

    async run (ctx) {
        const guild = this.client.guilds.cache.get(ctx.guildID);
        const channel = await guild.channels.fetch(ctx.channelID);
        const _member = await guild.members.fetch(ctx.member.id);

        const djMode = this.client.settings.get(ctx.guildID, 'djMode');
        const djRole = this.client.settings.get(ctx.guildID, 'djRole');
        const dj = _member.roles.cache.has(djRole) || channel.permissionsFor(_member.user.id).has(['MANAGE_CHANNELS']);
        if (djMode) {
            if (!dj) return this.client.ui.send(ctx, 'DJ_MODE');
        }

        const textChannel = this.client.settings.get(ctx.guildID, 'textChannel');
        if (textChannel) {
            if (textChannel !== channel.id) {
                return this.creator.ui.ctx(ctx, 'WRONG_TEXT_CHANNEL_MUSIC', textChannel);
            }
        }

        const vc = _member.voice.channel;
        if (!vc) return this.client.ui.send(ctx, 'NOT_IN_VC');

        // if (!text && !message.attachments.first()) return client.ui.usage(message, 'play <url/search/attachment>');

        if (ctx.subcommands[0] === 'query') {
            if (pornPattern(ctx.options.track)) return this.client.ui.ctx(ctx, 'no', "The URL you're requesting to play is not allowed.");
        }

        await ctx.defer();

        const currentVc = this.client.vc.get(vc);
        if (!currentVc) {
            const permissions = vc.permissionsFor(this.client.user.id).has(Permissions.FLAGS.CONNECT);
            if (!permissions) return this.client.ui.send(ctx, 'MISSING_CONNECT', vc.id);

            if (vc.type === 'stage') {
                await this.client.vc.join(vc); // Must be awaited only if the VC is a Stage Channel.
                const stageMod = vc.permissionsFor(this.client.user.id).has(Permissions.STAGE_MODERATOR);
                if (!stageMod) {
                    const requestToSpeak = vc.permissionsFor(this.client.user.id).has(Permissions.FLAGS.REQUEST_TO_SPEAK);
                    if (!requestToSpeak) {
                        this.client.vc.leave(guild);
                        return this.client.ui.send(ctx, 'MISSING_SPEAK', vc.id);
                    } else if (guild.me.voice.suppress) {
                        await guild.me.voice.setRequestToSpeak(true);
                    }
                } else {
                    await guild.me.voice.setSuppressed(false);
                }
            } else {
                this.client.vc.join(vc);
            }
        } else {
            if (vc.id !== currentVc.channel.id) return this.client.ui.send(ctx, 'ALREADY_SUMMONED_ELSEWHERE');
        }

        const queue = this.client.player.getQueue(guild.id);

        // These limitations should not affect a member with DJ permissions.
        if (!dj) {
            if (queue) {
                const maxQueueLimit = await this.client.settings.get(guild.id, 'maxQueueLimit');
                if (maxQueueLimit) {
                    const queueMemberSize = queue.songs.filter(entries => entries.user.id === _member.user.id).length;
                    if (queueMemberSize >= maxQueueLimit) {
                        return this.client.ui.ctx(ctx, 'no', `You are only allowed to add a max of ${maxQueueLimit} entr${maxQueueLimit === 1 ? 'y' : 'ies'} to the queue.`);
                    }
                }
            }
        }

        try {
            const requested = ctx.subcommands[0] === 'attachment'
                ? ctx.attachments.first().url
                : ctx.options.track?.query;

            /* eslint-disable-next-line no-useless-escape */
            await this.client.player.play(vc, requested.replace(/(^\\<+|\\>+$)/g, ''), {
                textChannel: channel,
                member: _member
            });
            return this.client.ui.ctxCustom(ctx, process.env.EMOJI_MUSIC, process.env.COLOR_MUSIC, `Requested \`${requested}\``);
        } catch (err) {
            this.client.logger.error(err.stack); // Just in case.
            return this.client.ui.ctx(ctx, 'error', `An unknown error occured:\n\`\`\`js\n${err.name}: ${err.message}\`\`\``, 'Player Error');
        }
    }
}

module.exports = CommandPlay;
