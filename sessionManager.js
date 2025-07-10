const { MongoClient } = require('mongodb');
require('dotenv').config();

class SessionManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.collection = null;
    this.isConnected = false;
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
      this.collection = this.db.collection('sessions');
      this.isConnected = true;
      
      console.log('✅ MongoDB Session Manager connected successfully');
    } catch (error) {
      console.error('❌ MongoDB Session Manager connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      console.log('🔌 MongoDB Session Manager disconnected');
    }
  }

  // Baileys session storage methods
  async sessionExists(options) {
    if (!this.isConnected) await this.connect();
    
    try {
      const session = await this.collection.findOne({ 
        sessionId: options.sessionId 
      });
      return !!session;
    } catch (error) {
      console.error('❌ Error checking session existence:', error);
      return false;
    }
  }

  async loadSession(options) {
    if (!this.isConnected) await this.connect();
    
    try {
      const session = await this.collection.findOne({ 
        sessionId: options.sessionId 
      });
      
      if (session) {
        console.log(`📱 Loaded session: ${options.sessionId}`);
        return session.creds;
      }
      
      console.log(`📱 No session found: ${options.sessionId}`);
      return null;
    } catch (error) {
      console.error('❌ Error loading session:', error);
      return null;
    }
  }

  async saveSession(sessionId, creds) {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.collection.updateOne(
        { sessionId },
        { 
          $set: { 
            sessionId, 
            creds, 
            updatedAt: new Date() 
          } 
        },
        { upsert: true }
      );
      
      console.log(`💾 Session saved: ${sessionId}`);
    } catch (error) {
      console.error('❌ Error saving session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    if (!this.isConnected) await this.connect();
    
    try {
      await this.collection.deleteOne({ sessionId });
      console.log(`🗑️ Session deleted: ${sessionId}`);
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      throw error;
    }
  }

  async listSessions() {
    if (!this.isConnected) await this.connect();
    
    try {
      const sessions = await this.collection.find({}).toArray();
      return sessions.map(s => s.sessionId);
    } catch (error) {
      console.error('❌ Error listing sessions:', error);
      return [];
    }
  }

  // Clean up old sessions (optional)
  async cleanupOldSessions(daysOld = 30) {
    if (!this.isConnected) await this.connect();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await this.collection.deleteMany({
        updatedAt: { $lt: cutoffDate }
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old sessions`);
    } catch (error) {
      console.error('❌ Error cleaning up sessions:', error);
    }
  }
}

// Create and export singleton instance
const sessionManager = new SessionManager();

module.exports = sessionManager;
