const { readAuthFolder } = require('./authFolderHelper');
const sessionManager = require('./sessionManager');

async function main() {
  try {
    const folderObj = readAuthFolder();
    if (!folderObj || Object.keys(folderObj).length === 0) {
      console.error('❌ No auth_info JSON files found. Make sure you have scanned the QR and have valid session files.');
      process.exit(1);
    }
    await sessionManager.saveAuthFolder(folderObj, 'auth_info');
    console.log('✅ Successfully uploaded auth_info folder to MongoDB!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to upload auth_info folder:', err);
    process.exit(1);
  }
}

main(); 