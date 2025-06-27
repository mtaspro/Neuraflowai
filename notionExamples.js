const { createPage, updatePage } = require('./notionClient');

// Example: Add a note to a Notion database
async function addNote(databaseId, title, content) {
  const properties = {
    Name: { title: [{ text: { content: title } }] },
    Content: { rich_text: [{ text: { content } }] },
    Type: { select: { name: 'Note' } },
    Date: { date: { start: new Date().toISOString() } }
  };
  return await createPage(databaseId, properties);
}

// Example: Add a todo item
async function addTodo(databaseId, task, done = false) {
  const properties = {
    Name: { title: [{ text: { content: task } }] },
    Status: { checkbox: done },
    Type: { select: { name: 'Todo' } },
    Date: { date: { start: new Date().toISOString() } }
  };
  return await createPage(databaseId, properties);
}

// Example: Add a journal entry
async function addJournalEntry(databaseId, entry) {
  const properties = {
    Name: { title: [{ text: { content: `Journal: ${new Date().toLocaleDateString()}` } }] },
    Content: { rich_text: [{ text: { content: entry } }] },
    Type: { select: { name: 'Journal' } },
    Date: { date: { start: new Date().toISOString() } }
  };
  return await createPage(databaseId, properties);
}

// In notionExamples.js
async function listNotes(databaseId, filter = {}) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Type',
        select: { equals: 'Note' },
        ...filter
      }
    });
    return response.results;
  } catch (error) {
    console.error('Notion listNotes error:', error.body || error.message);
    throw error;
  }
}

async function listTodos(databaseId, onlyPending = true) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: 'Type', select: { equals: 'Todo' } },
          ...(onlyPending ? [{ property: 'Status', checkbox: { equals: false } }] : [])
        ]
      }
    });
    return response.results;
  } catch (error) {
    console.error('Notion listTodos error:', error.body || error.message);
    throw error;
  }
}

async function getTodayJournalEntry(databaseId) {
  const today = new Date().toISOString().split('T')[0];
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: 'Type', select: { equals: 'Journal' } },
          { property: 'Date', date: { equals: today } }
        ]
      }
    });
    return response.results[0] || null;
  } catch (error) {
    console.error('Notion getTodayJournalEntry error:', error.body || error.message);
    throw error;
  }
}

async function searchNotesByKeyword(databaseId, keyword) {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Name',
        title: { contains: keyword }
      }
    });
    return response.results;
  } catch (error) {
    console.error('Notion searchNotesByKeyword error:', error.body || error.message);
    throw error;
  }
}

module.exports = { addNote, addTodo, addJournalEntry, listNotes, listTodos, getTodayJournalEntry, searchNotesByKeyword };