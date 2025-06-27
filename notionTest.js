const { addNote, addTodo, addJournalEntry } = require('./notionExamples');
const databaseId = process.env.NOTION_DATABASE_ID;

// Add a note
addNote(databaseId, "Meeting Notes", "Discussed project milestones.")
  .then(page => console.log("Note added:", page.id))
  .catch(console.error);

// Add a todo
addTodo(databaseId, "Buy groceries", false)
  .then(page => console.log("Todo added:", page.id))
  .catch(console.error);

// Add a journal entry
addJournalEntry(databaseId, "Today I learned about Notion API integration!")
  .then(page => console.log("Journal entry added:", page.id))
  .catch(console.error);