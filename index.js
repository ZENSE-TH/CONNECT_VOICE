const { Client, Intents } = require('discord.js-selfbot-v13');
const WebSocket = require('ws');
require('dotenv').config();

require('./server.js');

const TOKENS = process.env.DISCORD_TOKENS.split(','); // ใช้หลาย token
const GUILD_ID = process.env.GUILD_ID;
const TARGET_VOICE_CHANNEL_ID = process.env.TARGET_VOICE_CHANNEL_ID;

const CHECK_INTERVAL = 30000; // 30 วินาที
const RECONNECT_INTERVAL = 60000; // 60 วินาที

let bots = [];

function createBot(token) {
    const client = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES]
    });

    let ws;
    let isConnected = false;
    let timeout;

    client.on('ready', () => {
        console.log(`Logged in as ${client.user.tag}`);
        connectToVoiceChannel();
        monitorVoiceState();
    });

    function monitorVoiceState() {
        client.on('voiceStateUpdate', (oldState, newState) => {
            if (newState.member.id === client.user.id) {
                clearTimeout(timeout);

                if (!newState.channelId) {
                    isConnected = false;
                    timeout = setTimeout(() => {
                        connectToVoiceChannel();
                    }, CHECK_INTERVAL);
                } else if (newState.channelId === TARGET_VOICE_CHANNEL_ID && !isConnected) {
                    isConnected = true;
                    console.log(`${client.user.tag} เข้าห้อง ${newState.channel.name} สำเร็จ`);
                }
            }
        });
    }

    function connectToVoiceChannel() {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            console.log(`${client.user.tag}: ไม่สามารถหาเซิร์ฟเวอร์ได้`);
            return;
        }

        const channel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);

        if (channel && channel.type === 'GUILD_VOICE' && !isConnected) {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
            }

            ws.on('open', () => {
                const payload = {
                    op: 2,
                    d: {
                        token: token,
                        intents: 0,
                        properties: {
                            "$os": "windows",
                            "$browser": "chrome",
                            "$device": "pc"
                        }
                    }
                };
                ws.send(JSON.stringify(payload));

                const voiceStateUpdate = {
                    op: 4,
                    d: {
                        guild_id: GUILD_ID,
                        channel_id: TARGET_VOICE_CHANNEL_ID,
                        self_mute: true,
                        self_deaf: true
                    }
                };
                ws.send(JSON.stringify(voiceStateUpdate));
            });

            ws.on('close', () => {
                isConnected = false;
                console.log(`${client.user.tag}: ถูกตัดการเชื่อมต่อจาก WebSocket`);
                setTimeout(connectToVoiceChannel, RECONNECT_INTERVAL);
            });

            ws.on('error', (error) => {
                console.log(`${client.user.tag}: เกิดข้อผิดพลาดในการเชื่อมต่อ WebSocket - ${error.message}`);
                ws.close();
                setTimeout(connectToVoiceChannel, RECONNECT_INTERVAL);
            });
        } else if (!channel || channel.type !== 'GUILD_VOICE') {
            console.log(`${client.user.tag}: ไม่สามารถหา channel หรือ channel ไม่ใช่ GUILD_VOICE`);
        }
    }

    client.login(token);
    bots.push({ client, ws, isConnected });
}

// สร้างบอทใหม่ตามจำนวน token ที่มี
TOKENS.forEach((token) => {
    createBot(token);
});
