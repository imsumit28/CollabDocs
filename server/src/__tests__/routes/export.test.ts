import request from 'supertest';
import express, { Express } from 'express';
import { Types } from 'mongoose';
import * as Y from 'yjs';
import exportRoutes from '../../routes/export';
import { generateAccessToken } from '../helpers';
import { CollabDocument } from '../../models';

// Build a Y.Doc XML fragment with a heading + paragraph so the export node
// walker exercises its heading/paragraph branches.
function richState(): Buffer {
  const ydoc = new Y.Doc();
  const frag = ydoc.getXmlFragment('default');
  const heading = new Y.XmlElement('heading');
  heading.setAttribute('level', '1');
  heading.insert(0, [new Y.XmlText('My Heading')]);
  const para = new Y.XmlElement('paragraph');
  para.insert(0, [new Y.XmlText('Some body text.')]);
  frag.insert(0, [heading, para]);
  return Buffer.from(Y.encodeStateAsUpdate(ydoc));
}

describe('Export Routes', () => {
  let app: Express;
  let ownerId: string, strangerId: string;
  let ownerToken: string, strangerToken: string;
  let docId: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/export', exportRoutes);
    ownerId = new Types.ObjectId().toString();
    strangerId = new Types.ObjectId().toString();
    ownerToken = generateAccessToken(ownerId);
    strangerToken = generateAccessToken(strangerId);
  });

  beforeEach(async () => {
    const doc = await CollabDocument.create({ title: 'Export Me', ownerId, yjsState: richState() });
    docId = doc.id;
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  describe('GET /:id/docx', () => {
    it('returns a DOCX for the owner', async () => {
      const res = await request(app).get(`/api/export/${docId}/docx`).set(auth(ownerToken));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('officedocument.wordprocessingml');
      expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
    });

    it('denies a stranger (403)', async () => {
      const res = await request(app).get(`/api/export/${docId}/docx`).set(auth(strangerToken));
      expect(res.status).toBe(403);
    });

    it('404 for a missing document', async () => {
      const res = await request(app).get(`/api/export/${new Types.ObjectId()}/docx`).set(auth(ownerToken));
      expect(res.status).toBe(404);
    });
  });

  describe('GET /:id/pdf', () => {
    it('returns a PDF for the owner', async () => {
      const res = await request(app).get(`/api/export/${docId}/pdf`).set(auth(ownerToken)).buffer();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('denies a stranger (403)', async () => {
      const res = await request(app).get(`/api/export/${docId}/pdf`).set(auth(strangerToken));
      expect(res.status).toBe(403);
    });
  });
});
