require('dotenv').config(); // এই লাইনটা index.js এর একদম শুরুতে দাও
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !messages[0]?.message) return;

    const msg = messages[0];
    const from = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe;

    if (isFromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text) return;

    console.log(`📩 Message from ${from}: ${text}`);

    try {
      const groqRes = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama3-8b-8192', // বা llama3-70b-8192
          messages: [{ role: 'user', content: text }],
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const reply = groqRes.data.choices[0]?.message?.content?.trim();

      if (reply) {
        await sock.sendMessage(from, { text: reply });
      }
    } catch (err) {
      console.error("❌ Groq error:", err.response?.data || err.message);
      await sock.sendMessage(from, {
        text: "🤖 Bot e error hoise. Kisu khon por abar try koro!",
      });
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;

    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
    } else if (connection === 'close') {
      console.log('❌ Connection closed. Reconnecting...');
      startBot(); // Reconnect
    }
  });
}

startBot();
