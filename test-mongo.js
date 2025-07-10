// test-mongo.js
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB!');
    const dbs = await client.db().admin().listDatabases();
    console.log('Databases:', dbs.databases.map(db => db.name));
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
  } finally {
    await client.close();
  }
}

testConnection();
