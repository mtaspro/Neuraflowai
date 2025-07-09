const Tesseract = require('tesseract.js');

/**
 * Extract text from an image buffer using Tesseract.js
 * @param {Buffer} imageBuffer
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromImage(imageBuffer) {
  try {
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
    return text.trim();
  } catch (error) {
    console.error('Tesseract error:', error);
    return '';
  }
}

module.exports = { extractTextFromImage };