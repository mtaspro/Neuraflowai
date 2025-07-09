const { Client } = require('@notionhq/client');

// Initialize Notion client with API key from environment variables
const notion = new Client({ auth: process.env.NOTION_TOKEN });

/**
 * Create a new page in a Notion database.
 * @param {string} databaseId - The Notion database ID.
 * @param {object} properties - The properties object for the new page.
 * @returns {Promise<object>} - The created page object or error.
 */
async function createPage(databaseId, properties) {
  try {
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties,
    });
    return response;
  } catch (error) {
    console.error('Notion createPage error:', error.body || error.message);
    throw error;
  }
}

/**
 * Update an existing Notion page.
 * @param {string} pageId - The Notion page ID.
 * @param {object} properties - The properties to update.
 * @returns {Promise<object>} - The updated page object or error.
 */
async function updatePage(pageId, properties) {
  try {
    const response = await notion.pages.update({
      page_id: pageId,
      properties,
    });
    return response;
  } catch (error) {
    console.error('Notion updatePage error:', error.body || error.message);
    throw error;
  }
}

/**
 * Query a Notion database (read).
 * @param {string} databaseId
 * @param {object} filter (optional)
 * @returns {Promise<object[]>}
 */
async function queryDatabase(databaseId, filter = {}) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
    });
    return response.results;
  } catch (error) {
    console.error('Notion queryDatabase error:', error.body || error.message);
    throw error;
  }
}

module.exports = { createPage, updatePage, queryDatabase };