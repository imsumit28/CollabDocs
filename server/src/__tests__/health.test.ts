import request from 'supertest';
import app from '../index';
import { flushAllRooms } from '../socket';

describe('Health & lifecycle', () => {
  it('GET /health returns ok with db connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'connected' });
    expect(res.body.timestamp).toBeTruthy();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });

  it('returns 400 (not 500) for a malformed JSON body', async () => {
    // body-parser raises a 400 SyntaxError; the global error handler now passes
    // client-error statuses through instead of masking them as 500.
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ not valid json ');
    expect(res.status).toBe(400);
  });

  it('flushAllRooms resolves cleanly when no document rooms are open', async () => {
    await expect(flushAllRooms()).resolves.toBeUndefined();
  });
});
