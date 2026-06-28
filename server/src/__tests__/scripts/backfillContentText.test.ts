import * as Y from 'yjs';
import { backfillContentText } from '../../scripts/backfillContentText';
import { CollabDocument } from '../../models';
import { Types } from 'mongoose';

// Build an encoded Y.js state whose XML fragment (what plainTextFromDoc reads)
// contains the given text.
function xmlState(text: string): Buffer {
  const ydoc = new Y.Doc();
  const frag = ydoc.getXmlFragment('default');
  const p = new Y.XmlElement('paragraph');
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return Buffer.from(Y.encodeStateAsUpdate(ydoc));
}

describe('backfillContentText', () => {
  const ownerId = new Types.ObjectId().toString();

  it('populates contentText for docs that have none', async () => {
    const doc = await CollabDocument.create({
      title: 'Old doc',
      ownerId,
      yjsState: xmlState('searchable body text'),
      contentText: '',
    });

    const stats = await backfillContentText();

    expect(stats.scanned).toBe(1);
    expect(stats.updated).toBe(1);
    expect(stats.failed).toBe(0);

    const reloaded = await CollabDocument.findById(doc.id);
    expect(reloaded!.contentText).toBe('searchable body text');
  });

  it('skips docs that already have contentText (empty-only mode)', async () => {
    await CollabDocument.create({
      title: 'Indexed doc',
      ownerId,
      yjsState: xmlState('already indexed'),
      contentText: 'already indexed',
    });

    const stats = await backfillContentText();
    expect(stats.scanned).toBe(0);
    expect(stats.updated).toBe(0);
  });

  it('re-indexes everything in --all mode', async () => {
    await CollabDocument.create({
      title: 'Stale doc',
      ownerId,
      yjsState: xmlState('fresh content'),
      contentText: 'stale content', // out of date on purpose
    });

    const stats = await backfillContentText({ all: true });
    expect(stats.updated).toBe(1);

    const doc = await CollabDocument.findOne({ title: 'Stale doc' });
    expect(doc!.contentText).toBe('fresh content');
  });

  it('does not write in dry-run mode', async () => {
    const doc = await CollabDocument.create({
      title: 'Dry run doc',
      ownerId,
      yjsState: xmlState('would be indexed'),
      contentText: '',
    });

    const stats = await backfillContentText({ dryRun: true });
    expect(stats.updated).toBe(1);

    const reloaded = await CollabDocument.findById(doc.id);
    expect(reloaded!.contentText).toBe(''); // unchanged
  });

  it('ignores docs without Y.js state', async () => {
    await CollabDocument.create({ title: 'Empty doc', ownerId, yjsState: null, contentText: '' });
    const stats = await backfillContentText();
    expect(stats.scanned).toBe(0);
  });
});
