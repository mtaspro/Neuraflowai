// 📁 File: memory.js
const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'memory.json');
let memory = new Map();

const MAX_HISTORY = 10; // Keep only the last 10 messages per user

// 🔄 Load memory from file
function loadMemory() {
  if (fs.existsSync(MEMORY_FILE)) {
    const raw = fs.readFileSync(MEMORY_FILE);
    try {
      const data = JSON.parse(raw);
      memory = new Map(Object.entries(data));
    } catch (e) {
      console.error("❌ Failed to parse memory.json:", e);
    }
  }
}

// 💾 Save memory to file
function saveMemory() {
  const plainObject = Object.fromEntries(memory);
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(plainObject, null, 2));
}

// 🧠 Get conversation history for a user
function getHistory(userId) {
  return memory.get(userId) || [];
}

// 📝 Update conversation history
function updateHistory(userId, userMsg, botReply) {
  const history = memory.get(userId) || [];
  history.push({ role: 'user', content: userMsg });
  history.push({ role: 'assistant', content: botReply });

  // Limit history to the last MAX_HISTORY messages
  const trimmed = history.slice(-MAX_HISTORY);
  memory.set(userId, trimmed);
  saveMemory();
}

// ❌ Clear conversation history for a user
function clearHistory(userId) {
  memory.delete(userId);
  saveMemory();
}

module.exports = {
  loadMemory,
  saveMemory,
  getHistory,
  updateHistory,
  clearHistory,
};
