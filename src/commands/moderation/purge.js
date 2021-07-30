const { Command, Argument } = require('discord-akairo')

module.exports = class CommandPurge extends Command {
  constructor () {
    super('purge', {
      aliases: ['purge', 'pr', 'clean'],
      channel: 'guild',
      userPermissions: ['MANAGE_MESSAGES'],
      clientPermissions: ['MANAGE_MESSAGES'],
      category: '⚒ Moderation',
      description: {
        text: 'Bulk delete messages from chat.',
        usage: '<number:2-100>'
      },
      args: [
        {
          id: 'deleteCount',
          type: Argument.range('number', 1, 101),
          default: undefined
        }
      ]
    })
  }

  async exec (message, args) {
    if (!args) return this.client.ui.usage(message, 'purge <number:2-100>')
    message.delete()
    if (args.deleteCount) {
      try {
        message.channel.bulkDelete(args.deleteCount)
        return
      } catch (err) {
        return this.client.ui.say(message, 'error', err.message)
      }
    } else {
      return this.client.ui.say(message, 'warn', 'Number must be between 2 and 100.')
    }
  }
}
