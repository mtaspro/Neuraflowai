const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'auth_info');

// Read all JSON files in auth_info/ and return as { filename: fileContent }
function readAuthFolder() {
  if (!fs.existsSync(AUTH_DIR)) return {};
  const files = fs.readdirSync(AUTH_DIR).filter(f => f.endsWith('.json'));
  const data = {};
  for (const file of files) {
    const filePath = path.join(AUTH_DIR, file);
    data[file] = fs.readFileSync(filePath, 'utf8'); // Store as string
  }
  return data;
}

// Write { filename: fileContent } to auth_info/ (overwrites existing files)
function writeAuthFolder(data) {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
  for (const [file, content] of Object.entries(data)) {
    const filePath = path.join(AUTH_DIR, file);
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

module.exports = {
  readAuthFolder,
  writeAuthFolder,
  AUTH_DIR
}; 