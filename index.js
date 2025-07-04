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

    // Only respond with AI in group if message starts with @neuraflow
    if (isGroup && text.trim().toLowerCase().startsWith('@n')) {
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
          text: `@${sender.split('@')[0]} ${reply}`,
          mentions: [sender]
        }, { quoted: msg });

      } catch (error) {
        console.error("❌ AI error:", error?.response?.data || error.message);
        await sock.sendMessage(from, { text: "Sorry, I encountered an error processing your message. Please try again." }, { quoted: msg });
      }
      return;
    }

    // Command handlers (work in both group and private chat)
    if (text.trim().toLowerCase() === '/clear') {
      clearHistory(from);
      await sock.sendMessage(from, { text: "Chat history cleared." }, { quoted: msg });
      return;
    }

    if (text.toLowerCase().startsWith('/search ')) {
      const query = text.slice(8).trim();
      const results = await serperSearch(query);
      await sock.sendMessage(from, { text: results }, { quoted: msg });
      return;
    }

    // /note command
    if (text.toLowerCase().startsWith('/note ')) {
      const [title, ...contentArr] = text.slice(6).split('|');
      const content = contentArr.join('|').trim();
      if (!title || !content) {
        await sock.sendMessage(from, { text: "Usage: /note Title | Content" }, { quoted: msg });
        return;
      }
      try {
        await addNote(notesDbId, title.trim(), content);
        await sock.sendMessage(from, { text: "Note added to Notion." }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to add note." }, { quoted: msg });
      }
      return;
    }

    // /todo command
    if (text.toLowerCase().startsWith('/todo ')) {
      const task = text.slice(6).trim();
      if (!task) {
        await sock.sendMessage(from, { text: "Usage: /todo Task" }, { quoted: msg });
        return;
      }
      try {
        await addTodo(todoDbId, task, false);
        await sock.sendMessage(from, { text: "Todo added to Notion." }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to add todo." }, { quoted: msg });
      }
      return;
    }

    // /journal command
    if (text.toLowerCase().startsWith('/journal ')) {
      const entry = text.slice(9).trim();
      if (!entry) {
        await sock.sendMessage(from, { text: "Usage: /journal Your journal entry" }, { quoted: msg });
        return;
      }
      try {
        await addJournalEntry(journalDbId, entry);
        await sock.sendMessage(from, { text: "Journal entry added to Notion." }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to add journal entry." }, { quoted: msg });
      }
      return;
    }
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
