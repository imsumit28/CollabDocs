import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import { generateAccessToken } from '../helpers';

// Controllable OpenAI mock: mockCreate is swapped per-test to simulate success,
// streaming, or upstream failure. (jest hoists the mock above imports.)
const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

describe('AI endpoints', () => {
  let app: Express;
  let token: string;

  beforeAll(() => {
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const aiRoutes = require('../../routes/ai').default;
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);
    token = generateAccessToken(new Types.ObjectId().toString());
  });

  afterAll(() => { delete process.env.DEEPSEEK_API_KEY; });

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ choices: [{ message: { content: '  AI OUTPUT  ' } }] });
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // ─── Every text/content endpoint returns a trimmed result ──────────────────────
  const textEndpoints = ['improve', 'grammar', 'expand', 'simplify'];
  const contentEndpoints = ['summarize', 'outline', 'brainstorm', 'title'];

  it.each(textEndpoints)('POST /%s returns the AI result (trimmed)', async (ep) => {
    const res = await request(app).post(`/api/ai/${ep}`).set(auth()).send({ text: 'some input' });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('AI OUTPUT');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it.each(contentEndpoints)('POST /%s returns the AI result', async (ep) => {
    const res = await request(app).post(`/api/ai/${ep}`).set(auth()).send({ content: 'some content' });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe('AI OUTPUT');
  });

  // ─── Endpoints with an extra required parameter ────────────────────────────────
  describe('POST /tone', () => {
    it('rewrites with a valid tone', async () => {
      const res = await request(app).post('/api/ai/tone').set(auth()).send({ text: 'hi', tone: 'formal' });
      expect(res.status).toBe(200);
      // The system prompt should carry the requested tone.
      const sysPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(sysPrompt).toContain('formal');
    });
    it('400 when tone is missing', async () => {
      const res = await request(app).post('/api/ai/tone').set(auth()).send({ text: 'hi' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/tone is required/);
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it('400 when text is empty (validated before tone)', async () => {
      const res = await request(app).post('/api/ai/tone').set(auth()).send({ text: '', tone: 'formal' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /translate', () => {
    it('translates with a valid language', async () => {
      const res = await request(app).post('/api/ai/translate').set(auth()).send({ text: 'hi', language: 'French' });
      expect(res.status).toBe(200);
      const sysPrompt = mockCreate.mock.calls[0][0].messages[0].content;
      expect(sysPrompt).toContain('French');
    });
    it('400 when language is missing', async () => {
      const res = await request(app).post('/api/ai/translate').set(auth()).send({ text: 'hi' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/language is required/);
    });
  });

  // ─── Failure paths ─────────────────────────────────────────────────────────────
  describe('upstream + configuration failures', () => {
    it('returns 502 when the AI provider throws', async () => {
      mockCreate.mockRejectedValueOnce(new Error('upstream 500'));
      const res = await request(app).post('/api/ai/improve').set(auth()).send({ text: 'hi' });
      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/AI request failed/);
    });

    it('returns 502 for a streaming request when the provider throws before any chunk', async () => {
      mockCreate.mockRejectedValueOnce(new Error('stream open failed'));
      const res = await request(app).post('/api/ai/improve?stream=1').set(auth()).send({ text: 'hi' });
      expect(res.status).toBe(502);
    });

    it('returns 502 when DEEPSEEK_API_KEY is not configured', async () => {
      const saved = process.env.DEEPSEEK_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
      try {
        const res = await request(app).post('/api/ai/improve').set(auth()).send({ text: 'hi' });
        expect(res.status).toBe(502);
      } finally {
        process.env.DEEPSEEK_API_KEY = saved;
      }
    });
  });

  it('requires authentication on every endpoint', async () => {
    const res = await request(app).post('/api/ai/improve').send({ text: 'hi' });
    expect(res.status).toBe(401);
  });
});
