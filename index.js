require('dotenv').config();
const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { chat } = require('./llm');
const { chatWithQwen } = require('./gpt4o');
const { thinkWithDeepSeek } = require('./deepseek');
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

// Rate limiting for Qwen API calls (OpenRouter - Free tier)
const qwenRateLimiter = {
  requests: new Map(), // Track requests per minute
  maxRequests: 20, // Allow 20 requests per minute (very generous for free tier)
  
  canMakeRequest: function() {
    const now = Date.now();
    const minuteAgo = now - 60000; // 1 minute ago
    
    // Clean old entries
    for (const [timestamp] of this.requests) {
      if (timestamp < minuteAgo) {
        this.requests.delete(timestamp);
      }
    }
    
    // Count requests in last minute
    const recentRequests = Array.from(this.requests.keys())
      .filter(timestamp => timestamp > minuteAgo).length;
    
    return recentRequests < this.maxRequests;
  },
  
  addRequest: function() {
    const now = Date.now();
    this.requests.set(now, true);
  },
  
  getTimeUntilReset: function() {
    const now = Date.now();
    const oldestRequest = Math.min(...Array.from(this.requests.keys()));
    const timeElapsed = now - oldestRequest;
    const timeRemaining = 60000 - timeElapsed; // 60 seconds - elapsed time
    return Math.max(0, Math.ceil(timeRemaining / 1000)); // Return seconds
  }
};

// Rate limiting for DeepSeek API calls (OpenRouter - Free tier)
const deepseekRateLimiter = {
  requests: new Map(), // Track requests per minute
  maxRequests: 15, // Allow 15 requests per minute (reasoning tasks need more time)
  
  canMakeRequest: function() {
    const now = Date.now();
    const minuteAgo = now - 60000; // 1 minute ago
    
    // Clean old entries
    for (const [timestamp] of this.requests) {
      if (timestamp < minuteAgo) {
        this.requests.delete(timestamp);
      }
    }
    
    // Count requests in last minute
    const recentRequests = Array.from(this.requests.keys())
      .filter(timestamp => timestamp > minuteAgo).length;
    
    return recentRequests < this.maxRequests;
  },
  
  addRequest: function() {
    const now = Date.now();
    this.requests.set(now, true);
  },
  
  getTimeUntilReset: function() {
    const now = Date.now();
    const oldestRequest = Math.min(...Array.from(this.requests.keys()));
    const timeElapsed = now - oldestRequest;
    const timeRemaining = 60000 - timeElapsed; // 60 seconds - elapsed time
    return Math.max(0, Math.ceil(timeRemaining / 1000)); // Return seconds
  }
};

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
    if (text.trim().toLowerCase() === '/help') {
      const helpText = `
*NEURAFLOW Bot Manual*

AI Chat:
• @n [question] – Ask me anything (in groups)
• /ben [question] – Use Qwen3-235B for responses
• /think [question] – Use DeepSeek for reasoning and analysis
• /statusben – Check Qwen rate limit status
• /thinkstatus – Check DeepSeek rate limit status
• @n history – Show conversation history
• @n members – List group members

Utilities:
• /search [query] – Search the web
• /clear – Clear chat history
• Send image with @n [message] – Extract text from the image

  `;
      await sock.sendMessage(from, { text: helpText }, { quoted: msg });
      return;
    }

    // /qwen-status command - Check Qwen rate limit status
    if (text.trim().toLowerCase() === '/statusben') {
      const canMakeRequest = qwenRateLimiter.canMakeRequest();
      const timeRemaining = qwenRateLimiter.getTimeUntilReset();
      
      let statusText = `🤖 *Qwen3-235B (OpenRouter) Status*\n\n`;
      
      if (canMakeRequest) {
        statusText += `✅ *Available* - You can make a request now!\n`;
        statusText += `📊 Rate limit: 20 requests per minute\n`;
        statusText += `⏰ Next reset: ${timeRemaining} seconds\n`;
      } else {
        statusText += `⏰ *Rate Limited* - Please wait before making another request\n`;
        statusText += `⏳ Time remaining: ${timeRemaining} seconds\n`;
        statusText += `📊 Rate limit: 20 requests per minute\n`;
      }
      
      statusText += `\n💡 Use /ben [question] to use Qwen3-235B via OpenRouter`;
      
      await sock.sendMessage(from, { text: statusText }, { quoted: msg });
      return;
    }

    // /think-status command - Check DeepSeek rate limit status
    if (text.trim().toLowerCase() === '/thinkstatus') {
      const canMakeRequest = deepseekRateLimiter.canMakeRequest();
      const timeRemaining = deepseekRateLimiter.getTimeUntilReset();
      
      let statusText = `🧠 *Reasoning Status*\n\n`;
      
      if (canMakeRequest) {
        statusText += `✅ *Available* - You can make a reasoning request now!\n`;
        statusText += `📊 Rate limit: 15 requests per minute\n`;
        statusText += `⏰ Next reset: ${timeRemaining} seconds\n`;
      } else {
        statusText += `⏰ *Rate Limited* - Please wait before making another request\n`;
        statusText += `⏳ Time remaining: ${timeRemaining} seconds\n`;
        statusText += `📊 Rate limit: 15 requests per minute\n`;
      }
      
      statusText += `\n💡 Use /think [question] for logical reasoning and analysis`;
      
      await sock.sendMessage(from, { text: statusText }, { quoted: msg });
      return;
    }

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

    // /ben command - Use Qwen3-235B for responses
    if (text.toLowerCase().startsWith('/ben ')) {
      const userQuery = text.slice(5).trim();
      if (!userQuery) {
        await sock.sendMessage(from, { text: "Usage: /ben [your question or message]" }, { quoted: msg });
        return;
      }

      // Check rate limit before making API call
      if (!qwenRateLimiter.canMakeRequest()) {
        const timeRemaining = qwenRateLimiter.getTimeUntilReset();
        await sock.sendMessage(from, { 
          text: `⏰ Qwen API limit reached! Please wait for ${timeRemaining} seconds before trying again.\n\n20 requests per minute. You can make another request in ${timeRemaining} seconds.` 
        }, { quoted: msg });
        return;
      }

      try {
        // Add request to rate limiter
        qwenRateLimiter.addRequest();
        
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', from);

        const isIntroQuestion = /(who are you|tui ke|tumi ke|mahtab ke|neuraflow)/.test(userQuery.toLowerCase());
        
        // Use maximum history (50 instead of 20) for Qwen due to efficient system prompt
        const maximumHistory = await getHistory(from, 50);
        
        const contextMessages = [
          ...maximumHistory,
          { role: 'user', content: userQuery }
        ];

        const reply = await chatWithQwen(contextMessages, isIntroQuestion);
        if (!reply) return;

        // Update history with maximum limit for Qwen
        await updateHistory(from, userQuery, reply, 50);

        await sock.sendMessage(from, { text: reply }, { quoted: msg });

      } catch (error) {
        console.error("❌ Qwen error:", error?.response?.data || error.message);
        await sock.sendMessage(from, { text: "Sorry, I encountered an error processing your message. Please try again." }, { quoted: msg });
      }
      return;
    }

    // /think command - Use DeepSeek for reasoning and analysis
    if (text.toLowerCase().startsWith('/think ')) {
      const userQuery = text.slice(7).trim();
      if (!userQuery) {
        await sock.sendMessage(from, { text: "Usage: /think [your reasoning question or problem]" }, { quoted: msg });
        return;
      }

      // Check rate limit before making API call
      if (!deepseekRateLimiter.canMakeRequest()) {
        const timeRemaining = deepseekRateLimiter.getTimeUntilReset();
        await sock.sendMessage(from, { 
          text: `⏰ DeepSeek reasoning limit reached! Please wait for ${timeRemaining} seconds before trying again.\n\n15 requests per minute. You can make another request in ${timeRemaining} seconds.` 
        }, { quoted: msg });
        return;
      }

      try {
        // Add request to rate limiter
        deepseekRateLimiter.addRequest();
        
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', from);

        const isIntroQuestion = /(who are you|tui ke|tumi ke|mahtab ke|neuraflow)/.test(userQuery.toLowerCase());
        
        // Use moderate history (10) for DeepSeek reasoning tasks
        const reasoningHistory = await getHistory(from, 10);
        
        const contextMessages = [
          ...reasoningHistory,
          { role: 'user', content: userQuery }
        ];

        const reply = await thinkWithDeepSeek(contextMessages, isIntroQuestion);
        if (!reply) return;

        // Update history with moderate limit for DeepSeek
        await updateHistory(from, userQuery, reply, 10);

        await sock.sendMessage(from, { text: reply }, { quoted: msg });

      } catch (error) {
        console.error("❌ DeepSeek error:", error?.response?.data || error.message);
        await sock.sendMessage(from, { text: "Sorry, I encountered an error processing your reasoning request. Please try again." }, { quoted: msg });
      }
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
