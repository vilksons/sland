/// @components : sland.js

require('dotenv').config();
const app = require('../app.js');
const { Events } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const mMysql = require('../mysql');

const _prefix = process.env.APP_PREFIX || '!';

const config = require('../config.json');

/// @System : Auto Save Role
app.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (!oldMember) {
        try {
            oldMember = await newMember.guild.members.fetch(newMember.id);
        } catch (err) {
            console.error("Failed to fetch old member:" .red, err);
            return;
        }
    }

    const newRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
    const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

    newRoles.each(role => {
        const userId = newMember.id;
        const roleId = role.id;

        const query = 'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE role_id = ?';
        mMysql.query(query, [userId, roleId, roleId], (err, results) => {
            if (err) {
                console.error(`Error saving role ${role.name} for user ${newMember.user.tag}:` .red, err);
                return;
            }
            console.log(`Role ${role.name} saved for user ${newMember.user.tag}` .yellow);
        });
    });

    removedRoles.each(role => {
        const userId = newMember.id;
        const roleId = role.id;

        const query = 'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?';
        mMysql.query(query, [userId, roleId], (err, results) => {
            if (err) {
                console.error(`Error removing role ${role.name} for user ${newMember.user.tag}:` .red, err);
                return;
            }
            console.log(`Role ${role.name} removed for user ${newMember.user.tag}` .yellow);
        });
    });
});

app.on(Events.GuildMemberAdd, async (member) => {
    const userId = member.id;

    const query = 'SELECT role_id FROM user_roles WHERE user_id = ?';
    mMysql.query(query, [userId], (err, results) => {
        if (err) throw err;

        results.forEach(row => {
            const role = member.guild.roles.cache.get(row.role_id);
            if (role) {
                member.roles.add(role)
                    .then(() => console.log(`Restored role ${role.name} for user ${member.user.tag}` .yellow))
                    .catch(console.error);
            }
        });
    });
});

/// @System : Timeout New Member's
app.on(Events.GuildMemberAdd, async (member) => {
    try {                  /* 8 minutes */
        await member.timeout(8 * 60 * 1000, 'New member timeout');
        console.log(`Member ${member.user.tag} has been timed out for 8 minutes.` .yellow);
    } catch (error) {
        console.error('Failed to timeout member:' .red, error);
    }
});

/// @system : Block Messages
function fetchRestrictedChannels(callback) {
    const query = `SELECT channel_id FROM ${process.env.SQL_DATABASE}.blocked_channels`;

    mMysql.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching blocked channels:'.red, err);
            callback([]);
        } else {
            const blockedChannels = results.map(row => row.channel_id);
            callback(blockedChannels);
        }
    });
}

app.on(Events.MessageCreate, async (message) => {
    fetchRestrictedChannels((blockedChannelsWregex) => {
        if (!message || !message.content) return;

        const hasInappropriateContent = config.badWords.some(word => {
            try {
                const regex = new RegExp(word, "i");
                return regex.test(message.content);
            } catch (e) {
                return message.content.toLowerCase().includes(word.toLowerCase());
            }
        });

        if (hasInappropriateContent) {
            message.delete().catch(console.error);
            return;
        }

        if (blockedChannelsWregex.includes(message.channel.id)) {
            const containsRestrictedContent = config.blockedWregex.some(pattern => {
                try {
                    const regex = new RegExp(pattern, 'i');
                    return regex.test(message.content);
                } catch (e) {
                    return message.content.includes(pattern);
                }
            });

            if (containsRestrictedContent) {
                message.delete().catch(console.error);
                return;
            }
        }
    });
});

/// @system : No Emoji
app.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const emojiRegex = /^(?:<a?:\w+:\d+>|[\p{Emoji}])$/u;
  if (emojiRegex.test(message.content.trim())) {
    const channel = message.channel;

    const messages = await channel.messages.fetch({ limit: 2 });
    const previousMessage = messages.find((msg) => msg.id !== message.id);

    if (previousMessage) {
      try {
        await previousMessage.react(message.content.trim());
        await message.delete();
      } catch (error) {
        console.error("No Emoji is Error:" .red, error);
      }
    }
  }
});