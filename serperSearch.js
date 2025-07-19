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
    if (results.length === 0) return null;

    // Return raw search data for processing by AI
    return {
      query: query,
      results: results.slice(0, 5) // Get top 5 results for better context
    };
  } catch (err) {
    console.error('Serper Search Error:', err.response?.data || err.message);
    return null;
  }
}

// Keep the old function for backward compatibility
async function serperSearchFormatted(query) {
  const searchData = await serperSearch(query);
  if (!searchData) return "No results found.";

  return searchData.results.slice(0, 3).map(r =>
    `*${r.title}*\n${r.snippet}\n${r.link}`
  ).join('\n\n');
}

module.exports = { serperSearch, serperSearchFormatted };