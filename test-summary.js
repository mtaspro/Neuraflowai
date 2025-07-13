require('dotenv').config();
const { summarizeWithQwen } = require('./summaryHandler');

async function testSummary() {
  console.log('🧪 Testing Summary functionality with Qwen3-235B...\n');

  const testText = `Artificial Intelligence (AI) has emerged as one of the most transformative technologies of the 21st century. It encompasses a wide range of capabilities including machine learning, natural language processing, computer vision, and robotics. AI systems can now perform tasks that traditionally required human intelligence, such as recognizing speech, making decisions, and solving complex problems.

The development of AI has been driven by several key factors: the exponential growth in computing power, the availability of massive datasets, and breakthroughs in algorithms. Machine learning, particularly deep learning, has been at the forefront of recent AI advances. Neural networks with multiple layers can now process and learn from vast amounts of data, enabling applications like image recognition, language translation, and autonomous vehicles.

AI is already being applied across numerous industries. In healthcare, AI helps in disease diagnosis, drug discovery, and personalized treatment plans. In finance, it's used for fraud detection, algorithmic trading, and risk assessment. In transportation, AI powers self-driving cars and optimizes traffic flow. In education, it provides personalized learning experiences and automated grading systems.

However, the rapid advancement of AI also raises important ethical and societal concerns. Issues such as job displacement, privacy violations, algorithmic bias, and the potential for autonomous weapons systems require careful consideration. There's also the question of AI safety and ensuring that AI systems behave as intended and don't cause unintended harm.

The future of AI holds both promise and challenges. As AI becomes more sophisticated, it could help solve some of humanity's most pressing problems, from climate change to disease eradication. But this will require responsible development, robust governance frameworks, and ongoing dialogue between technologists, policymakers, and the public.

In conclusion, AI represents a paradigm shift in how we approach problem-solving and automation. While it offers tremendous opportunities for progress and innovation, it also demands thoughtful consideration of its implications for society, economy, and human welfare. The key to harnessing AI's potential lies in developing it responsibly and ensuring it serves the common good.`;

  try {
    console.log('📝 Original text length:', testText.length, 'characters\n');
    console.log('📄 Original text preview:', testText.substring(0, 200) + '...\n');

    const summary = await summarizeWithQwen([
      { role: 'user', content: testText }
    ]);

    if (summary) {
      console.log('✅ Summary generated successfully!');
      console.log('📊 Summary length:', summary.length, 'characters');
      console.log('📈 Compression ratio:', Math.round((summary.length / testText.length) * 100) + '%');
      console.log('\n📝 Summary:\n');
      console.log(summary);
    } else {
      console.log('❌ Failed to generate summary');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSummary(); 