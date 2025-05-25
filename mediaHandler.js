const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

async function saveMediaMessage(message, type = 'media') {
  const buffer = await message.download();
  const extension = mime.extension(message.mimetype);
  const fileName = `${Date.now()}.${extension}`;
  const filePath = path.join(__dirname, 'downloads', type);

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }

  fs.writeFileSync(path.join(filePath, fileName), buffer);
  return `${type}/${fileName}`;
}

module.exports = { saveMediaMessage };
