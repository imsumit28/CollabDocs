/**
 * Backfill the `contentText` search field on existing documents.
 *
 * The plain-text mirror that powers server-side search is only written when a
 * document is edited (socket save), flushed, or restored. Documents created
 * before that feature shipped — or never touched since — have an empty
 * `contentText`, so they don't show up in content searches. This one-off script
 * decodes each document's stored Y.js state and populates the field.
 *
 * Usage (from the server/ directory):
 *   npm run backfill:search                 # only docs with empty contentText
 *   npm run backfill:search -- --all        # re-index every document
 *   npm run backfill:search -- --dry-run    # report only, write nothing
 *
 * Safe to re-run; it only writes when the computed text differs.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { CollabDocument } from '../models';
import { plainTextFromState } from '../utils/yjsText';
import { logger } from '../utils/logger';

export interface BackfillOptions {
  all?: boolean;     // re-index every doc, not just those with empty contentText
  dryRun?: boolean;  // compute but never write
}

export interface BackfillStats {
  scanned: number;
  updated: number;
  failed: number;
}

/**
 * Walk documents and (re)populate their contentText. Assumes mongoose is
 * already connected. Returns counts so callers (CLI or tests) can report.
 */
export async function backfillContentText(opts: BackfillOptions = {}): Promise<BackfillStats> {
  const { all = false, dryRun = false } = opts;

  // Only documents that actually have Y.js state to decode.
  const filter: Record<string, unknown> = { yjsState: { $ne: null } };
  if (!all) filter.contentText = { $in: [null, ''] };

  const cursor = CollabDocument.find(filter).cursor();
  const stats: BackfillStats = { scanned: 0, updated: 0, failed: 0 };

  for await (const doc of cursor) {
    stats.scanned++;
    try {
      if (!doc.yjsState) continue;
      const text = plainTextFromState(doc.yjsState as Buffer);
      if (text === doc.contentText) continue; // nothing changed

      if (!dryRun) {
        doc.contentText = text;
        await doc.save();
      }
      stats.updated++;
      logger.debug({ docId: doc.id, chars: text.length }, 'Indexed document');
    } catch (err) {
      stats.failed++;
      logger.warn({ err, docId: doc.id }, 'Failed to index document');
    }
  }

  return stats;
}

// ─── CLI entrypoint ────────────────────────────────────────────────────────────
// Only runs when executed directly (not when imported by a test).
async function main() {
  const all = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');

  // Load .env the same way the server does (cwd/.env or cwd/server/.env).
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), 'server', '.env'),
  ];
  const envPath = envCandidates.find((c) => fs.existsSync(c));
  dotenv.config(envPath ? { path: envPath } : {});

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI is not set — cannot run backfill');
    process.exit(1);
  }

  await mongoose.connect(uri);
  logger.info({ mode: all ? 'all' : 'empty-only', dryRun }, 'Connected — starting contentText backfill');

  const stats = await backfillContentText({ all, dryRun });

  logger.info({ ...stats, dryRun }, 'Backfill complete');
  await mongoose.disconnect();
  process.exit(stats.failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'Backfill crashed');
    process.exit(1);
  });
}
