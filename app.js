/// @App : app.js

const { Collection, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const mMysql = require('./mysql');
const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
require('colors');
require('ts-node/register');
require('dotenv').config();

const { Erine, GatewayIntentBits } = require("erine");

const _prefix = process.env.APP_PREFIX || '!';

const app = new Erine({
    intents: Object.values(GatewayIntentBits),
    prefix: _prefix
});

app.commands = new Collection();
app.buttons = new Collection();
app.modals = new Collection();
app.selectMenus = new Collection();

module.exports = app;

const token = process.env.APP_TOKEN;
const config = require('./config.json');

const eventsPath = path.join(__dirname, 'events'); // @path : events
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) /* this is events */ {
    const filePath = path.join(eventsPath, file);
    delete require.cache[require.resolve(filePath)];

    const event = require(filePath);
    if (event.once) {
        app.once(event.name, (...args) => event.execute(...args, app));
    } else {
        app.on(event.name, (...args) => event.execute(...args, app));
    }
}

const ___deploy = require('./deploy');
const ___loadDirPath = require('./dirpath');

(async (/* this is async of deploy & dirpath */) => {
    try {
        await ___deploy();
        await ___loadDirPath();

        if (!token) {
            console.error('TOKEN is not defined in the environment variables.'.red);
            process.exit(1);
        }

        /* ts projects */
        require('./typescript/app.ts');

        /* login of bot */
        await app.login(token);

        app.once('ready', () => {
            console.log(`(js) Logged in as ${app.user.tag}`.yellow);

            app.user.setPresence({
                activities: [{
                    /* activity */
                    name: 'sland Bot & AI | 100% Open Source Project',
                    type: ActivityType.Listening
                }]
            });
        });

    } catch (error) {
        console.error("(js) Error Logged Application".red, error);
        process.exit(1);
    }
})();
