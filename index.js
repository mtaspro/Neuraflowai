require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { chat } = require('./llm');
const { serperSearch } = require('./serperSearch');
const { addNote, addTodo, addJournalEntry, listNotes, listTodos, getTodayJournalEntry, searchNotesByKeyword } = require('./notionExamples');

const {
  loadMemory,
  getHistory,
  updateHistory,
  clearHistory
} = require('./memory');

const notesDbId = process.env.NOTION_NOTES_DATABASE_ID;
const todoDbId = process.env.NOTION_TODO_DATABASE_ID;
const journalDbId = process.env.NOTION_JOURNAL_DATABASE_ID;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' || !messages[0]?.message) return;

    const msg = messages[0];
    const from = msg.key.remoteJid;
    const isFromMe = msg.key.fromMe;

    if (isFromMe) return;

    const history = getHistory(from);

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (!text.trim()) return;

    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;

    // Only reply in group if message starts with #
    if (isGroup && !text.trim().startsWith('#')) return;

    // /clear command
    if (text.trim().toLowerCase() === '/clear') {
      clearHistory(from);
      await sock.sendMessage(from, { text: "Chat history cleared." }, { quoted: msg });
      return;
    }

    const lowerText = text.toLowerCase();
    const isIntroQuestion = /(who are you|tui ke|tumi ke|mahtab ke|neuraflow)/.test(lowerText);
    console.log(`📩 Message from ${from}: ${text}`);

    const contextMessages = [
      ...history,
      { role: 'user', content: text }
    ];

    try {
      // Show typing indicator
      await sock.sendPresenceUpdate('composing', from);

      const reply = await chat(contextMessages, isIntroQuestion);
      if (!reply) return;

      updateHistory(from, text, reply);

      await sock.sendMessage(from, {
        text: isGroup ? `@${sender.split('@')[0]} ${reply}` : reply,
        mentions: isGroup ? [sender] : []
      }, { quoted: msg });

    } catch (error) {
      console.error("❌ AI error:", error?.response?.data || error.message);
      await sock.sendMessage(from, { text: "Sorry, I encountered an error processing your message. Please try again." }, { quoted: msg });
    }

    if (text.toLowerCase().startsWith('/search ')) {
      const query = text.slice(8).trim();
      const results = await serperSearch(query);
      await sock.sendMessage(from, { text: results }, { quoted: msg });
      return;
    }

    // Example: When user sends /note command
    await addNote(notesDbId, noteTitle, noteContent);

    // Example: When user sends /todo command
    await addTodo(todoDbId, todoTask, false);

    // Example: When user sends /journal command
    await addJournalEntry(journalDbId, journalText);
  });

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) qrcode.generate(qr, { small: true });
    if (connection === 'open') console.log('✅ Connected to WhatsApp!');
    else if (connection === 'close') {
      console.log('🔁 Connection closed. Reconnecting...');
      startBot();
    }
  });
}

// Start bot function এর শুরুতে মেমরি লোড করো
loadMemory();

startBot();
