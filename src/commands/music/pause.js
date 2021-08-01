const { Command } = require('discord-akairo')

module.exports = class CommandPause extends Command {
  constructor () {
    super('pause', {
      aliases: ['pause', 'halt'],
      category: '🎶 Music',
      description: {
        text: 'Pauses the player.'
      },
      channel: 'guild',
      clientPermissions: ['EMBED_LINKS']
    })
  }

  async exec (message) {
    const djMode = this.client.settings.get(message.guild.id, 'djMode')
    const djRole = this.client.settings.get(message.guild.id, 'djRole')
    const dj = message.member.roles.cache.has(djRole) || message.channel.permissionsFor(message.member.user.id).has(['MANAGE_CHANNELS'])
    if (djMode) {
      if (!dj) return this.client.ui.say(message, 'no', 'DJ Mode is currently active. You must have the DJ Role or the **Manage Channels** permission to use music commands at this time.', 'DJ Mode')
    }

    const textChannel = this.client.settings.get(message.guild.id, 'textChannel', null)
    if (textChannel) {
      if (textChannel !== message.channel.id) {
        return this.client.ui.say(message, 'no', `Music commands must be used in <#${textChannel}>.`)
      }
    }

    const vc = message.member.voice.channel
    if (!vc) return this.client.ui.say(message, 'error', 'You are not in a voice channel.')

    const currentVc = this.client.vc.get(vc)
    if (!this.client.player.getQueue(message) || !currentVc) return this.client.ui.say(message, 'warn', 'Nothing is currently playing in this server.')
    else if (vc.id !== currentVc.channel.id) return this.client.ui.say(message, 'error', 'You must be in the same voice channel that I\'m in to use that command.')

    if (vc.members.size <= 2 || dj) {
      await this.client.player.pause(message)
      const prefix = this.client.settings.get(message.guild.id, 'prefix', process.env.PREFIX)
      return this.client.ui.custom(message, '⏸', process.env.COLOR_INFO, 'Paused', null, `Type ${prefix}play to resume playback.`)
    } else {
      return this.client.ui.say(message, 'error', 'You must have the DJ role on this server, or the **Manage Channel** permission to use that command. Being alone with me works too!')
    }
  }
}
