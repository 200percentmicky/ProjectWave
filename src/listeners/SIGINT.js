const { Listener } = require('discord-akairo');

module.exports = class ListenerSIGINT extends Listener
{
    constructor()
    {
        super('SIGINT', {
            emitter: 'process',
            event: 'SIGINT'
        });
    }

    async exec(error)
    {
        this.client.destroy();
        process.exit(0);
    }

};
