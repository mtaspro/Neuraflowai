const { createPage, queryDatabase } = require('./notionClient');

const dbMap = {
  Language: process.env.DB_LANGUAGE,
  ICT: process.env.DB_ICT,
  Mathematics: process.env.DB_MATH,
  Physics: process.env.DB_PHYSICS,
  Chemistry: process.env.DB_CHEMISTRY,
  Biology: process.env.DB_BIO,
};

const linkPropMap = {
  Language: "Link or File",
  ICT: "Link or File",
  Mathematics: "Link or File",
  Physics: "Link or File",
  Chemistry: "Link or File",
  Biology: "Link or File",
};

/**
 * Add a link to a subject database.
 * @param {string} subject - e.g. "Language", "Physics"
 * @param {string} note
 * @param {string} link
 */
async function addLinkToSubject(subject, note, link) {
  const dbId = dbMap[subject];
  const linkProp = linkPropMap[subject];
  if (!dbId || !linkProp) throw new Error('Invalid subject');
  return createPage(dbId, {
    Name: { title: [{ text: { content: note } }] },
    [linkProp]: { url: link },
  });
}

/**
 * List all links from a subject database.
 * @param {string} subject - e.g. "ICT"
 * @returns {Promise<object[]>}
 */
async function listLinksFromSubject(subject) {
  const dbId = dbMap[subject];
  if (!dbId) throw new Error('Invalid subject');
  return queryDatabase(dbId);
}

module.exports = {
  addLinkToSubject,
  listLinksFromSubject,
  dbMap,
  linkPropMap,
};