require('dotenv').config();
const { chatWithQwen } = require('./gpt4o');

async function testQwen() {
  console.log('🧪 Testing Qwen3-235B via OpenRouter...\n');
  
  // Test 1: Check if API key exists
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('❌ OPENROUTER_API_KEY not found in environment variables');
    return;
  }
  console.log('✅ OPENROUTER_API_KEY found');
  
  // Test 2: Simple test message
  const testMessages = [
    { role: 'user', content: 'Hello, can you respond with "Test successful" in Bengali?' }
  ];
  
  try {
    console.log('📤 Sending test request to OpenRouter (Qwen3-235B)...');
    const response = await chatWithQwen(testMessages, false);
    
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
testQwen().catch(console.error); 