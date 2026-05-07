const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');
const natural = require('natural');

require('dotenv').config({ path: 'api.env' });

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

const PORT = process.env.PORT || 3000;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

let documents = [];

let images = [];

let chatHistory = [];

// =========================
// LOCAL SUMMARIZER
// =========================

function summarizeText(text, sentenceCount = 5) {

  if (!text || text.length < 50) {

    return 'Document is too short to summarize.';
  }

  text = text.replace(/\n/g, ' ');

  const tokenizer =
    new natural.SentenceTokenizer();

  const sentences =
    tokenizer.tokenize(text);

  const wordTokenizer =
    new natural.WordTokenizer();

  const stopwords =
    natural.stopwords;

  const freq = {};

  sentences.forEach(sentence => {

    const words =
      wordTokenizer
        .tokenize(sentence.toLowerCase());

    words.forEach(word => {

      if (

        /^[a-z]+$/.test(word) &&

        !stopwords.includes(word)
      ) {

        freq[word] =
          (freq[word] || 0) + 1;
      }
    });
  });

  const scored =
    sentences.map(sentence => {

      const words =
        wordTokenizer
          .tokenize(sentence.toLowerCase());

      let score = 0;

      words.forEach(word => {

        if (freq[word]) {

          score += freq[word];
        }
      });

      return {

        sentence,

        score
      };
    });

  scored.sort((a, b) =>

    b.score - a.score
  );

  const summary =
    scored
      .slice(0, sentenceCount)
      .map(s => s.sentence)
      .join(' ');

  return summary;
}

// =========================
// IMAGE PROMPT DETECTION
// =========================

function isImagePrompt(text) {

  const keywords = [

    'generate image',
    'generate',
    'create image',
    'draw',
    'art',
    'picture',
    'photo',
    'painting',
    'illustration',
    'image of'
  ];

  text = text.toLowerCase();

  return keywords.some(word =>
    text.includes(word)
  );
}

// =========================
// FILE UPLOAD
// =========================

app.post(
  '/upload',
  upload.single('file'),

  async (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      // IMAGE FILES

      if (

        req.file.mimetype === 'image/png' ||

        req.file.mimetype === 'image/jpeg' ||

        req.file.mimetype === 'image/jpg'
      ) {

        images.push({

          mimeType: req.file.mimetype,

          base64:
            req.file.buffer.toString('base64')
        });

        return res.json({
          message: 'Image uploaded'
        });
      }

      // PDF/TXT FILES

      let text = '';

      if (
        req.file.mimetype === 'application/pdf'
      ) {

        const data =
          await pdfParse(req.file.buffer);

        text = data.text;

      } else {

        text =
          req.file.buffer.toString('utf8');
      }

      documents.push(text);

      res.json({
        message: 'Document uploaded'
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        error: 'Upload failed'
      });
    }
  }
);

// =========================
// CHAT
// =========================

app.post('/chat', async (req, res) => {

  try {

    const { message } = req.body;

    console.log('User:', message);

    // =====================
    // IMAGE GENERATION
    // =====================

    if (isImagePrompt(message)) {

      const imageUrl =
        `https://image.pollinations.ai/prompt/${encodeURIComponent(message)}`;

      return res.json({

        type: 'image',

        image: imageUrl
      });
    }

    // =====================
    // DOCUMENT CONTEXT
    // =====================

    let documentContext = '';

    if (documents.length > 0) {

      documentContext =
        documents.join('\n');
    }

    // =====================
    // GROQ AI
    // =====================

    try {

      const completion =
        await groq.chat.completions.create({

          messages: [

            {
              role: 'system',

              content: `

You are an intelligent AI assistant.

You help users summarize documents,
answer questions,
and analyze uploaded content.

Answer naturally and accurately.

`
            },

            {
              role: 'user',

              content: `

Previous Conversation:
${chatHistory.join('\n')}

Document Context:
${documentContext}

User Message:
${message}

`
            }
          ],

          model:
            'llama-3.3-70b-versatile',

          temperature: 0.5,
        });

      const reply =
        completion.choices[0]
          .message.content;

      // SAVE CHAT HISTORY

      chatHistory.push(
        `User: ${message}`
      );

      chatHistory.push(
        `Assistant: ${reply}`
      );

      return res.json({

        type: 'text',

        reply
      });

    } catch (groqError) {

      console.log(groqError);

      // =====================
      // LOCAL FALLBACK
      // =====================

      let fallbackReply =
        'Groq API temporarily unavailable.';

      const lowerMessage =
        message.toLowerCase();

      const doc =
        documents.join(' ');

      // DOCUMENT SUMMARY

      if (

        lowerMessage.includes('summary') ||

        lowerMessage.includes('summarize')
      ) {

        if (doc.length > 0) {

          fallbackReply =
            summarizeText(doc);

        } else {

          fallbackReply =
            'No document uploaded.';
        }
      }

      return res.json({

        type: 'text',

        reply: fallbackReply
      });
    }

  } catch (error) {

    console.log(error);

    res.status(500).json({

      error: 'Chat failed'
    });
  }
});

// =========================
// RESET CHAT
// =========================

app.post('/reset', (req, res) => {

  documents = [];

  images = [];

  chatHistory = [];

  res.json({
    message: 'Chat reset successful'
  });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );
});