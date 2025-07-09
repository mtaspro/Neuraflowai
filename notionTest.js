const { addLinkToSubject, listLinksFromSubject } = require('./notionExamples');

// Test adding a link to the "Language" database
addLinkToSubject("Language", "Test Note", "https://example.com")
  .then(page => console.log("Link added! Page ID:", page.id))
  .catch(console.error);

// List links from the "Language" database
listLinksFromSubject("Language")
  .then(links => {
    links.forEach((n, i) => {
      const title = n.properties.note?.title?.[0]?.plain_text || 'Untitled';
      // Use the correct property for the link column:
      const url = n.properties["Link or File"]?.url || n.properties["File or link"]?.url || n.properties["File or Link"]?.url || '';
      console.log(`${i + 1}. ${title}: ${url}`);
    });
  })
  .catch(console.error);