const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

async function saveMediaMessage(message, type = 'media') {
  try {
    const buffer = await message.download();
    const extension = mime.extension(message.mimetype) || 'bin';
    const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const fileName = `${unique}.${extension}`;
    const filePath = path.join(__dirname, 'downloads', type);

    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, { recursive: true });
    }

    fs.writeFileSync(path.join(filePath, fileName), buffer);
    return `${type}/${fileName}`;
  } catch (err) {
    console.error('Failed to save media:', err);
    return null;
  }
}

module.exports = { saveMediaMessage };
