require('dotenv').config();
const { thinkWithDeepSeek } = require('./deepseek');

async function testDeepSeek() {
  console.log('🧠 Testing DeepSeek Chat v3 via OpenRouter...\n');
  
  // Test 1: Check if API key exists
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('❌ OPENROUTER_API_KEY not found in environment variables');
    return;
  }
  console.log('✅ OPENROUTER_API_KEY found');
  
  // Test 2: Simple reasoning test
  const testMessages = [
    { role: 'user', content: 'If a train leaves station A at 2 PM traveling at 60 mph, and another train leaves station B at 3 PM traveling at 80 mph towards station A, and the stations are 200 miles apart, when will they meet?' }
  ];
  
  try {
    console.log('📤 Sending reasoning test to DeepSeek...');
    const response = await thinkWithDeepSeek(testMessages, false);
    
    if (response) {
      console.log('✅ API call successful!');
      console.log('📥 Response:', response);
    } else {
      console.log('❌ No response received');
    }
  } catch (error) {
    console.log('❌ API call failed:');
    console.log('Error:', error.message);
    if (error.response?.data) {
      console.log('API Error Details:', error.response.data);
    }
  }
}

// Run the test
testDeepSeek().catch(console.error); 