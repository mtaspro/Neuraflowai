const { MongoClient } = require('mongodb');
require('dotenv').config();

class MemoryManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
    this.MAX_HISTORY = 10; // Keep only the last 10 messages per user
    this.SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  }

  async connect() {
    try {
      const connectionString = process.env.MONGODB_URI || 'mongodb+srv://mowama36:<db_password>@neuraflow-bot.9fmavbm.mongodb.net/?retryWrites=true&w=majority&appName=neuraflow-bot';
      
      this.client = new MongoClient(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      await this.client.connect();
      this.db = this.client.db('whatsapp-bot');
      this.collection = this.db.collection('conversation_memory');
      this.isConnected = true;
      
      console.log('✅ MongoDB Memory Manager connected successfully');
    } catch (error) {
      console.error('❌ MongoDB Memory Manager connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 MongoDB Memory Manager disconnected');
    }
  }

  // Get conversation history for a user
  async getHistory(userId) {
    if (!this.isConnected) await this.connect();
    
    try {
      const user = await this.collection.findOne({ userId });
      if (!user) return [];
      
      // Filter out messages older than 7 days
      const now = Date.now();
      const filteredMessages = user.messages.filter(msg => 
        !msg.timestamp || (now - msg.timestamp <= this.SEVEN_DAYS)
      );
      
      // Update the database with filtered messages
      if (filteredMessages.length !== user.messages.length) {
        await this.collection.updateOne(
          { userId },
          { $set: { messages: filteredMessages, updatedAt: new Date() } }
        );
      }
      
      return filteredMessages;
    } catch (error) {
      console.error('❌ Error getting history:', error);
      return [];
    }
  }

  // Update conversation history
  async updateHistory(userId, userMsg, botReply) {
    if (!this.isConnected) await this.connect();
    
    try {
      const now = Date.now();
      const newMessages = [
        { role: 'user', content: userMsg, timestamp: now },
        { role: 'assistant', content: botReply, timestamp: now }
      ];

      // Get current messages and add new ones
      const currentMessages = await this.getHistory(userId);
      const allMessages = [...currentMessages, ...newMessages];
      
      // Keep only the last MAX_HISTORY * 2 messages (user + bot pairs)
      const limitedMessages = allMessages.slice(-this.MAX_HISTORY * 2);
      
      // Update or insert the user's conversation
      await this.collection.updateOne(
        { userId },
        { 
          $set: { 
            userId,
            messages: limitedMessages,
            updatedAt: new Date()
          } 
        },
        { upsert: true }
      );
      
      console.log(`💾 Memory updated for user: ${userId} (${limitedMessages.length} messages)`);
    } catch (error) {
      console.error('❌ Error updating history:', error);
    }
  }

  // Clear conversation history for a user
  async clearHistory(userId) {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.collection.deleteOne({ userId });
      console.log(`🗑️ Memory cleared for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error clearing history:', error);
    }
  }

  // Get all users with their message counts
  async getAllUsers() {
    if (!this.isConnected) await this.connect();
    
    try {
      const users = await this.collection.find({}).toArray();
      return users.map(user => ({
        userId: user.userId,
        messageCount: user.messages ? user.messages.length : 0,
        lastUpdated: user.updatedAt
      }));
    } catch (error) {
      console.error('❌ Error getting all users:', error);
      return [];
    }
  }

  // Clean up old messages (auto-purge older than 7 days)
  async cleanupOldMessages() {
    if (!this.isConnected) await this.connect();
    
    try {
      const cutoffTime = Date.now() - this.SEVEN_DAYS;
      
      // Get all users
      const users = await this.collection.find({}).toArray();
      let totalCleaned = 0;
      
      for (const user of users) {
        if (!user.messages) continue;
        
        const filteredMessages = user.messages.filter(msg => 
          msg.timestamp && msg.timestamp > cutoffTime
        );
        
        if (filteredMessages.length !== user.messages.length) {
          await this.collection.updateOne(
            { userId: user.userId },
            { $set: { messages: filteredMessages, updatedAt: new Date() } }
          );
          totalCleaned += (user.messages.length - filteredMessages.length);
        }
      }
      
      console.log(`🧹 Cleaned up ${totalCleaned} old messages from all users`);
    } catch (error) {
      console.error('❌ Error cleaning up old messages:', error);
    }
  }

  // Get memory statistics
  async getStats() {
    if (!this.isConnected) await this.connect();
    
    try {
      const totalUsers = await this.collection.countDocuments();
      const users = await this.collection.find({}).toArray();
      
      const totalMessages = users.reduce((sum, user) => 
        sum + (user.messages ? user.messages.length : 0), 0
      );
      
      const avgMessagesPerUser = totalUsers > 0 ? (totalMessages / totalUsers).toFixed(2) : 0;
      
      return {
        totalUsers,
        totalMessages,
        avgMessagesPerUser,
        maxHistoryPerUser: this.MAX_HISTORY * 2
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { totalUsers: 0, totalMessages: 0, avgMessagesPerUser: 0 };
    }
  }

  // Load memory (compatibility with existing memory.js)
  async loadMemory() {
    if (!this.isConnected) await this.connect();
    console.log('📚 Memory Manager loaded');
  }

  // Save memory (compatibility with existing memory.js)
  async saveMemory() {
    // No-op for MongoDB since it's automatically saved
    console.log('💾 Memory automatically saved to MongoDB');
  }
}

// Create and export singleton instance
const memoryManager = new MemoryManager();

// Export functions for compatibility with existing memory.js
module.exports = {
  loadMemory: () => memoryManager.loadMemory(),
  saveMemory: () => memoryManager.saveMemory(),
  getHistory: (userId) => memoryManager.getHistory(userId),
  updateHistory: (userId, userMsg, botReply) => memoryManager.updateHistory(userId, userMsg, botReply),
  clearHistory: (userId) => memoryManager.clearHistory(userId),
  getAllUsers: () => memoryManager.getAllUsers(),
  cleanupOldMessages: () => memoryManager.cleanupOldMessages(),
  getStats: () => memoryManager.getStats(),
  disconnect: () => memoryManager.disconnect()
};
