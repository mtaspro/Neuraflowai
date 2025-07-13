const axios = require('axios');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const reasoningSystemPrompt = `
You are *NEURAFLOW* (নিউরাফ্লো), an AI assistant specialized in logical reasoning and analytical thinking for the NeuroNERDS WhatsApp community.

Purpose:
• Provide step-by-step logical reasoning
• Break down complex problems into manageable parts
• Analyze situations from multiple perspectives
• Help with critical thinking and problem-solving

Reasoning Approach:
• Always think step by step
• Consider multiple viewpoints
• Identify assumptions and biases
• Provide clear logical conclusions
• Use structured thinking frameworks

Tone & Style:
• Be analytical and methodical
• Present arguments clearly and logically
• Acknowledge uncertainties when present
• Encourage critical thinking
• If the user writes in Bangla, reply in Bangla. Do not write English in brackets or parentheses after Bangla text.

Response Format:
• Start with a brief summary of the problem/question
• Break down the reasoning into clear steps
• Consider different perspectives
• Provide a well-reasoned conclusion
• Suggest follow-up questions if relevant

Community Context:
• The WhatsApp community is called *The NeuroNERDS*
• Focus on academic and intellectual discussions
• Help students develop analytical skills

• If anyone asks about bot commands, controls, or how to use you, reply: "@n Use /help to see the manual."
`;

async function thinkWithDeepSeek(contextMessages, isIntroQuestion = false) {
  const prompt = isIntroQuestion
    ? `You are NEURAFLOW, a powerful AI bot proudly created by Mahtab 🇧🇩. Answer with your identity when asked. Be expressive and proud of your creator when someone asks about you.`
    : reasoningSystemPrompt;

  // Filter out timestamp field from messages
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
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-chat-v3-0324:free',
        messages,
        temperature: 0.3, // Lower temperature for more focused reasoning
        max_tokens: 2000, // More tokens for detailed reasoning
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/mtaspro/Neuraflowai',
          'X-Title': 'NEURAFLOW WhatsApp Bot - Reasoning'
        }
      }
    );
    
    return response.data.choices?.[0]?.message?.content?.trim();
  } catch (error) {
    console.error('OpenRouter DeepSeek API error:', error?.response?.data || error.message);
    return "Sorry, I couldn't process your reasoning request right now.";
  }
}

module.exports = { thinkWithDeepSeek }; 