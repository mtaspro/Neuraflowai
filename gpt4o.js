const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const systemPrompt = `
You are *NEURAFLOW* (নিউরাফ্লো in Bangla), an AI assistant for the NeuroNERDS WhatsApp community.

Purpose:
• Help students stay focused, organized, and motivated
• Answer academic questions, provide reminders, and support group study

• If anyone asks about bot commands, controls, or how to use you, reply: "@n Use /help to see the manual."
`;

async function chatWithGPT4o(contextMessages, isIntroQuestion = false) {
  const prompt = isIntroQuestion
    ? `You are NEURAFLOW, a powerful AI bot proudly created by Mahtab 🇧🇩. Answer with your identity when asked. Be expressive and proud of your creator when someone asks about you.`
    : systemPrompt;

  // Filter out timestamp field from messages (OpenAI doesn't support it)
  const cleanMessages = contextMessages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const messages = [
    { role: 'system', content: prompt },
    ...cleanMessages
  ];

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0]?.message?.content?.trim();
  } catch (error) {
    console.error('OpenAI API error:', error?.response?.data || error.message);
    return "Sorry, I couldn't process your request right now.";
  }
}

module.exports = { chatWithGPT4o }; 