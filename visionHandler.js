const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

// Ensure tesseract-lang folder exists
const LANG_DIR = path.join(__dirname, 'tesseract-lang');
if (!fs.existsSync(LANG_DIR)) {
  fs.mkdirSync(LANG_DIR);
  console.warn('Created tesseract-lang folder. Please add .traineddata files for OCR languages.');
}

/**
 * Extract text from image buffer using Tesseract.js
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} [lang='eng'] - Language code ('eng' for English, 'ben' for Bengali)
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromImage(imageBuffer, lang = 'ben+eng') {
  try {
    // Check if both traineddata files exist
    const benPath = path.join(LANG_DIR, 'ben.traineddata');
    const engPath = path.join(LANG_DIR, 'eng.traineddata');
    if (!fs.existsSync(benPath)) {
      throw new Error('ben.traineddata not found in tesseract-lang folder. Please add it for Bengali OCR.');
    }
    if (!fs.existsSync(engPath)) {
      throw new Error('eng.traineddata not found in tesseract-lang folder. Please add it for English OCR.');
    }
    const { data: { text } } = await Tesseract.recognize(
      imageBuffer,
      lang,
      {
        langPath: LANG_DIR,
        logger: m => process.env.NODE_ENV !== 'production' && console.log(m),
      }
    );
    return text.trim();
  } catch (err) {
    console.error('OCR error:', err.message || err);
    return '❌ OCR failed: ' + (err.message || err);
  }
}

module.exports = { extractTextFromImage };