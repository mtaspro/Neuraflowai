const axios = require('axios');
require('dotenv').config();

async function askGroq(message) {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama3-8b-8192', // চাইলে 'mixtral-8x7b-32768' দিতে পারো
        messages: [{ role: 'user', content: message }],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Groq Error:', err.response?.data || err.message);
    return "Sorry, AI reply failed.";
  }
}

module.exports = askGroq;
