import { Router, Response } from 'express';
import OpenAI from 'openai';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { aiRateLimit } from '../middleware/rateLimit';
import { validateAIInput } from '../utils/validation';

const router = Router();
router.use(authMiddleware, aiRateLimit);

// Validate and bound the user-supplied input. Caps length (MAX_AI_INPUT) so a
// single request can't run up the AI bill or be used to exhaust the quota.
// Returns the trimmed text, or null after sending a 400 response.
function readInput(res: Response, value: unknown): string | null {
  const err = validateAIInput(value as string);
  if (err) {
    res.status(400).json({ error: err.message });
    return null;
  }
  return (value as string).trim();
}

// DeepSeek exposes an OpenAI-compatible API, so we use the OpenAI SDK
// pointed at DeepSeek's base URL. The client is created lazily because the
// OpenAI SDK throws on construction when no apiKey is present — DEEPSEEK_API_KEY
// is optional, so we must not crash the server at boot when it's unset.
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return client;
}

async function callAI(systemPrompt: string, userContent: string): Promise<string> {
  const completion = await getClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    // deepseek-v4-flash is a reasoning model: reasoning_content shares this
    // budget with the answer, so keep it generous to avoid truncated output.
    max_tokens: 4000,
    temperature: 0.7,
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

// Run an AI task and respond. Streams the answer as plain-text chunks when the
// client asks (?stream=1 or { stream: true }); otherwise returns { result }.
async function runAI(req: AuthRequest, res: Response, systemPrompt: string, userContent: string): Promise<void> {
  const wantsStream = req.query.stream === '1' || req.body?.stream === true;

  if (!wantsStream) {
    try {
      res.json({ result: await callAI(systemPrompt, userContent) });
    } catch {
      res.status(502).json({ error: 'AI request failed. Please try again.' });
    }
    return;
  }

  try {
    const stream = await getClient().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 4000,
      temperature: 0.7,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // disable proxy buffering so chunks flush

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) res.write(delta);
    }
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: 'AI request failed. Please try again.' });
    } else {
      res.end();
    }
  }
}

// ─── Improve Writing ──────────────────────────────────────────────────────────
router.post('/improve', async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (readInput(res, text) === null) return;
  await runAI(req, res,
    'You are a professional writing assistant. Rewrite the provided text to be clearer, more professional, and more concise. Return only the rewritten text with no preamble or explanation.',
    text);
});

// ─── Summarise ────────────────────────────────────────────────────────────────
router.post('/summarize', async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (readInput(res, content) === null) return;
  await runAI(req, res,
    'You are a document summariser. Summarise the provided document content in exactly 3 clear, informative sentences. Return only the summary.',
    content);
});

// ─── Grammar Fix ──────────────────────────────────────────────────────────────
router.post('/grammar', async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (readInput(res, text) === null) return;
  await runAI(req, res,
    'You are a grammar and spelling corrector. Fix only grammar and spelling errors in the provided text. Do NOT change the style, tone, or content. Return only the corrected text.',
    text);
});

// ─── Expand / Elaborate ───────────────────────────────────────────────────────
router.post('/expand', async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (readInput(res, text) === null) return;
  await runAI(req, res,
    'You are a writing assistant. Expand and elaborate on the provided text, adding more detail, examples, and explanation to make it more comprehensive. Return only the expanded text.',
    text);
});

// ─── Simplify ─────────────────────────────────────────────────────────────────
router.post('/simplify', async (req: AuthRequest, res: Response) => {
  const { text } = req.body;
  if (readInput(res, text) === null) return;
  await runAI(req, res,
    'You are a writing assistant. Simplify the provided text using plain language, shorter sentences, and no jargon. Return only the simplified text.',
    text);
});

// ─── Tone Shift ───────────────────────────────────────────────────────────────
router.post('/tone', async (req: AuthRequest, res: Response) => {
  const { text, tone } = req.body;
  if (readInput(res, text) === null) return;
  if (!tone?.trim()) { res.status(400).json({ error: 'tone is required' }); return; }
  await runAI(req, res,
    `You are a writing assistant. Rewrite the provided text in a ${tone} tone. Preserve the meaning and key information. Return only the rewritten text.`,
    text);
});

// ─── Generate Outline ─────────────────────────────────────────────────────────
router.post('/outline', async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (readInput(res, content) === null) return;
  await runAI(req, res,
    'You are a document assistant. Create a clear hierarchical outline with bullet points based on the provided content. Include main sections and key sub-points. Return only the outline.',
    content);
});

// ─── Brainstorm Ideas ─────────────────────────────────────────────────────────
router.post('/brainstorm', async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (readInput(res, content) === null) return;
  await runAI(req, res,
    'You are a creative assistant. Based on the provided content, brainstorm 5-8 related ideas, next steps, or improvements. Format as a numbered list. Return only the ideas.',
    content);
});

// ─── Translate ────────────────────────────────────────────────────────────────
router.post('/translate', async (req: AuthRequest, res: Response) => {
  const { text, language } = req.body;
  if (readInput(res, text) === null) return;
  if (!language?.trim()) { res.status(400).json({ error: 'language is required' }); return; }
  await runAI(req, res,
    `You are a professional translator. Translate the provided text to ${language}. Return only the translated text.`,
    text);
});

// ─── Generate Title ───────────────────────────────────────────────────────────
router.post('/title', async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (readInput(res, content) === null) return;
  await runAI(req, res,
    'You are a writing assistant. Generate 3 compelling title or heading suggestions for the provided content. Format as a numbered list. Return only the titles.',
    content);
});

export default router;
