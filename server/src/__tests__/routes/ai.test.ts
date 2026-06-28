import request from 'supertest';
import express, { Express } from 'express';
import aiRoutes from '../../routes/ai';
import { generateAccessToken } from '../helpers';
import { Types } from 'mongoose';

/**
 * AI route validation tests.
 *
 * These exercise the input-validation guard only (the 400 paths), which runs
 * before any call to the external AI provider — so no API key or network is
 * needed. The key protection: a single request cannot exceed MAX_AI_INPUT
 * (default 10,000 chars), preventing oversized payloads from running up cost.
 */
describe('AI Routes - input validation', () => {
  let app: Express;
  let token: string;

  beforeAll(() => {
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/ai', aiRoutes);
    token = generateAccessToken(new Types.ObjectId().toString());
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/ai/improve').send({ text: 'hello' });
    expect(res.status).toBe(401);
  });

  it('rejects empty text (400)', async () => {
    const res = await request(app).post('/api/ai/improve').set(auth()).send({ text: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects missing text (400)', async () => {
    const res = await request(app).post('/api/ai/grammar').set(auth()).send({});
    expect(res.status).toBe(400);
  });

  it('rejects input exceeding the max length (400)', async () => {
    const huge = 'a'.repeat(10_001);
    const res = await request(app).post('/api/ai/improve').set(auth()).send({ text: huge });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/under .* characters/i);
  });

  it('validates content-based endpoints too (summarize)', async () => {
    const huge = 'b'.repeat(10_001);
    const res = await request(app).post('/api/ai/summarize').set(auth()).send({ content: huge });
    expect(res.status).toBe(400);
  });
});
