const axios = require('axios');

const SERPER_API_KEY = process.env.SERPER_API_KEY;

async function serperSearch(query) {
  try {
    const response = await axios.post(
      'https://google.serper.dev/search',
      { q: query },
      {
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const results = response.data.organic || [];
    if (results.length === 0) return "No results found.";

    return results.slice(0, 3).map(r =>
      `*${r.title}*\n${r.snippet}\n${r.link}`
    ).join('\n\n');
  } catch (err) {
    console.error('Serper Search Error:', err.response?.data || err.message);
    return "Sorry, I couldn't fetch web results.";
  }
}

module.exports = { serperSearch };