import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import { generateAccessToken } from '../helpers';

// Mock the OpenAI SDK: stream:true yields delta chunks, otherwise a completion.
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: async (opts: any) => {
          if (opts.stream) {
            return (async function* () {
              yield { choices: [{ delta: { content: 'Hello ' } }] };
              yield { choices: [{ delta: { content: 'world' } }] };
            })();
          }
          return { choices: [{ message: { content: 'Hello world' } }] };
        },
      },
    },
  })),
}));

describe('AI streaming', () => {
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

  it('streams plain-text chunks when stream=1', async () => {
    const res = await request(app)
      .post('/api/ai/improve?stream=1')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hi' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toBe('Hello world');
  });

  it('returns JSON when not streaming', async () => {
    const res = await request(app)
      .post('/api/ai/improve')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'hi' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('Hello world');
  });

  it('still validates input before streaming (400)', async () => {
    const res = await request(app)
      .post('/api/ai/improve?stream=1')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });
});
