const { Command } = require('discord-akairo');
const { Permissions } = require('discord.js');

function pornPattern (url) {
  // ! TODO: Come up with a better regex lol
  // eslint-disable-next-line no-useless-escape
  const pornPattern = /https?:\/\/(www\.)?(pornhub|xhamster|xvideos|porntube|xtube|youporn|pornerbros|pornhd|pornotube|pornovoisines|pornoxo)\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/g;
  const pornRegex = new RegExp(pornPattern);
  return url.match(pornRegex);
}

module.exports = class CommandPlay extends Command {
  constructor () {
    super('play', {
      aliases: ['play', 'p'],
      category: '🎶 Music',
      description: {
        text: 'Play\'s a song from a URL or search term.',
        usage: '<url/search>',
        details: '`<url/search>` The URL or search term to load.'
      },
      channel: 'guild',
      clientPermissions: ['EMBED_LINKS']
    });
  }

  async exec (message) {
    const args = message.content.split(/ +/g);
    const text = args.slice(1).join(' ');

    const djMode = this.client.settings.get(message.guild.id, 'djMode');
    const djRole = this.client.settings.get(message.guild.id, 'djRole');
    const dj = message.member.roles.cache.has(djRole) || message.channel.permissionsFor(message.member.user.id).has(['MANAGE_CHANNELS']);
    if (djMode) {
      if (!dj) return this.client.ui.reply(message, 'no', 'DJ Mode is currently active. You must have the DJ Role or the **Manage Channels** permission to use music commands at this time.', 'DJ Mode');
    }

    const textChannel = this.client.settings.get(message.guild.id, 'textChannel', null);
    if (textChannel) {
      if (textChannel !== message.channel.id) {
        return this.client.ui.reply(message, 'no', `Music commands must be used in <#${textChannel}>.`);
      }
    }

    const vc = message.member.voice.channel;
    if (!vc) return this.client.ui.reply(message, 'error', 'You are not in a voice channel.');

    if (!text && !message.attachments.first()) return this.client.ui.usage(message, 'play <url/search/attachment>');

    if (pornPattern(text)) return this.client.ui.reply(message, 'no', "The URL you're requesting to play is not allowed.");

    const currentVc = this.client.vc.get(vc);
    if (!currentVc) {
      const permissions = vc.permissionsFor(this.client.user.id).has(Permissions.FLAGS.CONNECT);
      if (!permissions) return this.client.ui.reply(message, 'no', `Missing **Connect** permission for <#${vc.id}>`);

      if (vc.type === 'stage') {
        await this.client.vc.join(vc); // Must be awaited only if the VC is a Stage Channel.
        const stageMod = vc.permissionsFor(this.client.user.id).has(Permissions.STAGE_MODERATOR);
        if (!stageMod) {
          const requestToSpeak = vc.permissionsFor(this.client.user.id).has(Permissions.FLAGS.REQUEST_TO_SPEAK);
          if (!requestToSpeak) {
            this.client.vc.leave(message);
            return this.client.ui.reply(message, 'no', `Missing **Request to Speak** permission for <#${vc.id}>.`);
          } else if (message.guild.me.voice.suppress) {
            await message.guild.me.voice.setRequestToSpeak(true);
          }
        } else {
          await message.guild.me.voice.setSuppressed(false);
        }
      } else {
        this.client.vc.join(vc);
      }
    } else {
      if (vc.id !== currentVc.channel.id) return this.client.ui.reply(message, 'error', 'You must be in the same voice channel that I\'m in to use that command.');
    }

    message.channel.sendTyping();
    const queue = this.client.player.getQueue(message.guild.id);

    // These limitations should not affect a member with DJ permissions.
    if (!dj) {
      if (queue) {
        const maxQueueLimit = await this.client.settings.get(message.guild.id, 'maxQueueLimit');
        if (maxQueueLimit) {
          const queueMemberSize = queue.songs.filter(entries => entries.user.id === message.member.user.id).length;
          if (queueMemberSize >= maxQueueLimit) {
            return this.client.ui.reply(message, 'no', `You are only allowed to add a max of ${maxQueueLimit} entr${maxQueueLimit === 1 ? 'y' : 'ies'} to the queue.`);
          }
        }
      }
    }

    try {
      /* eslint-disable-next-line no-useless-escape */
      await this.client.player.play(message, text.replace(/(^\<+|\>+$)/g, '') || message.attachments.first().url);
      return message.react(process.env.EMOJI_MUSIC);
    } catch (err) {
      this.client.logger.error(err.stack); // Just in case.
      return this.client.ui.reply(message, 'error', `An unknown error occured:\n\`\`\`js\n${err.name}: ${err.message}\`\`\``, 'Player Error');
    }
  }
};
