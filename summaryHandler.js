const axios = require('axios');

// Specialized system prompt for summarization tasks
const SUMMARY_SYSTEM_PROMPT = `You are an expert text summarizer. Your task is to create concise, accurate, and well-structured summaries of any text provided to you.

Key Guidelines:
1. **Conciseness**: Create summaries that are 20-30% of the original text length
2. **Accuracy**: Maintain all key facts, dates, names, and important details
3. **Structure**: Use bullet points or numbered lists for better readability
4. **Clarity**: Use simple, clear language that's easy to understand
5. **Completeness**: Include main ideas, conclusions, and essential context
6. **Objectivity**: Present information neutrally without personal opinions

For different types of content:
- **Articles/News**: Focus on main story, key facts, and implications
- **Academic/Technical**: Emphasize methodology, findings, and conclusions
- **Conversations/Discussions**: Highlight main points and decisions made
- **Long Documents**: Break into logical sections with sub-summaries

Always start your response with "📝 **Summary:**" and format the summary clearly with appropriate spacing and structure.`;

async function summarizeWithQwen(messages, isIntroQuestion = false) {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwen3-235b-a22b:free',
        messages: [
          {
            role: 'system',
            content: SUMMARY_SYSTEM_PROMPT
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.3, // Lower temperature for more consistent summarization
        top_p: 0.9,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/your-repo/whatsapp-bot',
          'X-Title': 'NEURAFLOW WhatsApp Bot'
        }
      }
    );

    const reply = response.data.choices[0]?.message?.content;
    
    if (!reply) {
      console.error('❌ No response content from Qwen summary API');
      return null;
    }

    console.log(`✅ Summary generated successfully (${reply.length} characters)`);
    return reply;

  } catch (error) {
    console.error('❌ Error calling Qwen summary API:', error?.response?.data || error.message);
    return null;
  }
}

module.exports = {
  summarizeWithQwen
}; 