// 📁 File: memory.js
const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'memory.json');
let memory = new Map();

const MAX_HISTORY = 5; // Keep only the last 5 messages per user
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

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
function getHistory(userId, maxHistory = MAX_HISTORY) {
  const messages = memory.get(userId) || [];
  // Limit to specified maxHistory
  return messages.slice(-maxHistory * 2);
}

// 📝 Update conversation history (NO sender info)
function updateHistory(userId, userMsg, botReply, maxHistory = MAX_HISTORY) {
  let arr = memory.get(userId) || [];
  arr.push({ role: 'user', content: userMsg, timestamp: Date.now() });
  arr.push({ role: 'assistant', content: botReply, timestamp: Date.now() });
  const now = Date.now();
  arr = arr.filter(m => !m.timestamp || (now - m.timestamp <= SEVEN_DAYS));
  if (arr.length > maxHistory * 2) arr = arr.slice(-maxHistory * 2);
  memory.set(userId, arr);
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
