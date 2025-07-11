require('dotenv').config();
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { chat } = require('./llm');
const { serperSearch } = require('./serperSearch');
const { addNote, addTodo, addJournalEntry, addNoteToSubject, listNotesFromSubject, dbMap, addLinkToSubject, listLinksFromSubject, linkPropMap } = require('./notionExamples');
const { extractTextFromImage } = require('./visionHandler');

// MongoDB-based managers
const sessionManager = require('./sessionManager');
const {
  loadMemory,
  getHistory,
  updateHistory,
  clearHistory
} = require('./memoryManager');
const { writeAuthFolder } = require('./authFolderHelper');

// Express server setup for Render deployment
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Server is running', 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`🚀 Express server is running on port ${PORT}`);
  console.log(`📡 Health check available at: http://localhost:${PORT}/`);
});

const notesDbId = process.env.NOTION_NOTES_DATABASE_ID;
const todoDbId = process.env.NOTION_TODO_DATABASE_ID;
const journalDbId = process.env.NOTION_JOURNAL_DATABASE_ID;

// --- Group members cache and fetch function ---
let groupMetaCache = {};

async function getGroupMembers(sock, groupId) {
  if (!groupMetaCache[groupId]) {
    const meta = await sock.groupMetadata(groupId);
    groupMetaCache[groupId] = meta.participants;
  }
  return groupMetaCache[groupId];
}

async function startBot() {
  // Use Baileys' built-in auth state with the restored folder
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

    const history = await getHistory(from);

    // Support text from conversation, extendedTextMessage, or image caption
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption || // <-- add this line
      '';

    if (!text.trim()) return;

    const isGroup = from.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;

    // --- OCR for image messages with @n in caption ---
    if (
      msg.message.imageMessage &&
      text.trim().toLowerCase().startsWith('@n')
    ) {
      
      
      const stream = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger: sock.logger, reuploadRequest: sock.updateMediaMessage }
      );
      const buffer = Buffer.isBuffer(stream) ? stream : Buffer.from([]);
      if (buffer.length > 0) {
        const extractedText = await extractTextFromImage(buffer);
        await sock.sendMessage(from, {
          text: extractedText
            ? `Extracted text:\n${extractedText}`
            : "Couldn't extract any text from the image.",
        }, { quoted: msg });
        return;
      }
    }
    
    // --- Group special commands ---
    if (isGroup && text.trim().toLowerCase().startsWith('@n')) {
      const lowerText = text.toLowerCase();
      const userQuery = lowerText.replace(/^@n\s*/, '');

      // Show last few messages in memory
      if (userQuery.startsWith('history') || userQuery.startsWith('show memory')) {
        const historyArr = await getHistory(from) || [];
        if (historyArr.length === 0) {
          await sock.sendMessage(from, { text: "No history found.", mentions: [sender] }, { quoted: msg });
          return;
        }
        let historyText = historyArr.map((h, i) => `${i + 1}. ${h.role === 'user' ? '👤' : '🤖'}: ${h.content}`).join('\n');
        await sock.sendMessage(from, { text: `Last ${historyArr.length} messages in memory:\n${historyText}`, mentions: [sender] }, { quoted: msg });
        return;
      }

      // List group members
      if (userQuery.startsWith('members')) {
        const members = await getGroupMembers(sock, from);
        const memberMentions = members.map(m => `@${m.id.split('@')[0]}`).join(', ');
        await sock.sendMessage(from, {
          text: `Group members:\n${memberMentions}`,
          mentions: members.map(m => m.id)
        }, { quoted: msg });
        return;
      }

      // --- AI reply logic ---
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

        await updateHistory(from, text, reply);

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

    // --- Command handlers (work in both group and private chat) ---
    if (text.trim().toLowerCase() === '/clear') {
      await clearHistory(from);
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

    // Add note: /addnote subject|title|content
    if (text.toLowerCase().startsWith('/addnote ')) {
      const [subject, title, ...contentArr] = text.slice(9).split('|');
      const content = contentArr.join('|').trim();
      if (!subject || !title || !content || !dbMap[subject.trim().toLowerCase()]) {
        await sock.sendMessage(from, { text: "Usage: /addnote subject|title|content\nSubjects: " + Object.keys(dbMap).join(', ') }, { quoted: msg });
        return;
      }
      try {
        await addNoteToSubject(subject.trim(), title.trim(), content);
        await sock.sendMessage(from, { text: `Note added to ${subject.trim()}.` }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to add note." }, { quoted: msg });
      }
      return;
    }

    // List notes: /listnotes subject
    if (text.toLowerCase().startsWith('/listnotes ')) {
      const subject = text.slice(10).trim().toLowerCase();
      if (!dbMap[subject]) {
        await sock.sendMessage(from, { text: "Usage: /listnotes subject\nSubjects: " + Object.keys(dbMap).join(', ') }, { quoted: msg });
        return;
      }
      try {
        const notes = await listNotesFromSubject(subject);
        if (!notes.length) {
          await sock.sendMessage(from, { text: "No notes found." }, { quoted: msg });
          return;
        }
        let msgText = `Notes in ${subject}:\n` + notes.map((n, i) => {
          const title = n.properties.Name?.title?.[0]?.plain_text || 'Untitled';
          const content = n.properties.Content?.rich_text?.[0]?.plain_text || '';
          return `${i + 1}. ${title}: ${content}`;
        }).join('\n');
        await sock.sendMessage(from, { text: msgText }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to list notes." }, { quoted: msg });
      }
      return;
    }

    // Add link: /addlink Subject|Note|URL
    if (text.toLowerCase().startsWith('/addlink ')) {
      const [subject, note, ...linkArr] = text.slice(9).split('|');
      const link = linkArr.join('|').trim();
      if (!subject || !note || !link || !dbMap[subject.trim()]) {
        await sock.sendMessage(from, { text: "Usage: /addlink Subject|Note|URL\nSubjects: " + Object.keys(dbMap).join(', ') }, { quoted: msg });
        return;
      }
      try {
        await addLinkToSubject(subject.trim(), note.trim(), link);
        await sock.sendMessage(from, { text: `Link added to ${subject.trim()}.` }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to add link." }, { quoted: msg });
      }
      return;
    }

    // List links: /listlinks Subject
    if (text.toLowerCase().startsWith('/listlinks ')) {
      const subject = text.slice(11).trim();
      if (!dbMap[subject]) {
        await sock.sendMessage(from, { text: "Usage: /listlinks Subject\nSubjects: " + Object.keys(dbMap).join(', ') }, { quoted: msg });
        return;
      }
      try {
        const links = await listLinksFromSubject(subject);
        const linkProp = linkPropMap[subject];
        if (!links.length) {
          await sock.sendMessage(from, { text: "No links found." }, { quoted: msg });
          return;
        }
        let msgText = `Links in ${subject}:\n` + links.map((n, i) => {
          const title = n.properties.Name?.title?.[0]?.plain_text || 'Untitled';
          const url = n.properties[linkProp]?.url || '';
          return `${i + 1}. ${title}: ${url}`;
        }).join('\n');
        await sock.sendMessage(from, { text: msgText }, { quoted: msg });
      } catch (err) {
        await sock.sendMessage(from, { text: "Failed to list links." }, { quoted: msg });
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

// Restore auth_info folder from MongoDB before Baileys init
async function restoreAuthFolderFromMongo() {
  const folderObj = await sessionManager.loadAuthFolder('auth_info');
  if (folderObj) {
    writeAuthFolder(folderObj);
    console.log('✅ Restored auth_info folder from MongoDB');
  } else {
    console.warn('⚠️ No auth_info found in MongoDB. You may need to scan QR and run run-once.js.');
  }
}

// Initialize MongoDB and start bot
async function initializeBot() {
  try {
    await loadMemory();
    await restoreAuthFolderFromMongo();
    await startBot();
  } catch (error) {
    console.error('❌ Failed to initialize bot:', error);
    process.exit(1);
  }
}

// Time-based condition for Dhaka (UTC+6)
(function checkDhakaActiveHours() {
  const now = new Date();
  // Convert to UTC+6 (Dhaka time)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const dhaka = new Date(utc + (6 * 60 * 60 * 1000));
  const hour = dhaka.getHours();
  const minute = dhaka.getMinutes();
  // Active hours: 6:00 (6AM) to 23:59 (11:59PM)
  if (hour >= 6 && (hour < 24)) {
    console.log('✅ Within active hours. Starting bot...');
  } else {
    console.log('⏰ Outside active hours. Exiting bot.');
    process.exit(0);
  }
})();

initializeBot();
