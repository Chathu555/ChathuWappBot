const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const readline = require('readline');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Chathu-MD WhatsApp Bot is Running!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        generateHighQualityLinkPreview: true
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Kamathinam phone number eka danna (eg: 9477xxxxxxx): ');
        if (phoneNumber) {
            setTimeout(async () => {
                let code = await sock.requestPairingCode(phoneNumber.trim());
                console.log(`\n========================================`);
                console.log(`YOUR PAIRING CODE IS: ${code}`);
                console.log(`========================================\n`);
            }, 3000);
        }
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot Successfully Connected!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    const messageStore = new Map();

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message) return;

        messageStore.set(msg.key.id, msg);

        const isViewOnce = msg.message.viewOnceMessage || msg.message.viewOnceMessageV2;
        if (isViewOnce) {
            try {
                const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                let sender = msg.key.remoteJid;

                await sock.sendMessage(sender, { 
                    text: "Hithan inne aaye balanna baeh kiyalada?" 
                });

                await sock.sendMessage(botNumber, { 
                    text: `👀 **Anti-View Once Detected!**\n\n*Powered with Chathu-MD*` 
                });
                await sock.sendMessage(botNumber, { forward: msg });
            } catch (err) {
                console.log('Error handling view once:', err);
            }
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.message === null || update.update.edit) {
                const deletedMsgId = update.key.id;
                const originalMsg = messageStore.get(deletedMsgId);

                if (originalMsg) {
                    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    let sender = originalMsg.key.remoteJid;
                    let senderName = originalMsg.pushName || "Unknown";
                    let timestamp = new Date(originalMsg.messageTimestamp * 1000).toLocaleString();
                    
                    await sock.sendMessage(sender, { 
                        text: "Delete karata wadak nae dakala ivarai.\n\nChathu-MD" 
                    });

                    let alertText = `⚠️ **Anti-Delete Alert!**\n`;
                    alertText += `👤 Kawuda: ${senderName} (${sender.split('@')[0]})\n`;
                    alertText += `📅 Welawa: ${timestamp}\n\n`;
                    alertText += `*Powered with Chathu-MD*`;

                    await sock.sendMessage(botNumber, { text: alertText });
                    await sock.sendMessage(botNumber, { forward: originalMsg });
                }
            }
        }
    });
}

startBot();
