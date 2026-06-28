import { Router, Response } from 'express';
import * as Y from 'yjs';
import PDFDocument from 'pdfkit';
import { CollabDocument } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

const router = Router();
router.use(authMiddleware);

// ─── Y.js → plain content nodes ──────────────────────────────────────────────
interface ContentNode {
  type: 'heading' | 'paragraph' | 'codeblock';
  level?: number;
  text: string;
  align?: string;
}

function getElementText(el: Y.XmlElement | Y.XmlFragment): string {
  let text = '';
  el.toArray().forEach((child) => {
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      text += getElementText(child);
    }
  });
  return text;
}

function extractNodes(yjsState: Buffer): ContentNode[] {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, new Uint8Array(yjsState));

  const xmlFragment = ydoc.getXmlFragment('default');
  const nodes: ContentNode[] = [];

  function walkElement(el: Y.XmlElement | Y.XmlFragment) {
    el.toArray().forEach((child) => {
      if (!(child instanceof Y.XmlElement)) return;
      const tag = child.nodeName.toLowerCase();

      if (tag === 'heading') {
        const level = parseInt(child.getAttribute('level') || '1', 10);
        const text = getElementText(child).trim();
        if (text) nodes.push({ type: 'heading', level, text });
      } else if (tag === 'codeblock') {
        const text = getElementText(child).trim();
        if (text) nodes.push({ type: 'codeblock', text });
      } else if (tag === 'paragraph') {
        const align = child.getAttribute('textAlign') || undefined;
        const text = getElementText(child).trim();
        nodes.push({ type: 'paragraph', text, align });
      } else {
        // bulletList, orderedList, listItem — recurse
        walkElement(child);
      }
    });
  }

  walkElement(xmlFragment);
  return nodes;
}


const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function nodesToDocxParagraphs(title: string, nodes: ContentNode[]): Paragraph[] {
  const titlePara = new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
  });

  const bodyParas = nodes.map((n) => {
    const alignment = n.align ? ALIGN_MAP[n.align] : undefined;
    if (n.type === 'heading') {
      return new Paragraph({
        text: n.text,
        heading: HEADING_LEVELS[n.level ?? 1] ?? HeadingLevel.HEADING_1,
        alignment,
      });
    }
    if (n.type === 'codeblock') {
      return new Paragraph({
        children: [new TextRun({ text: n.text, font: 'Courier New', size: 18 })],
      });
    }
    return new Paragraph({
      children: [new TextRun(n.text)],
      alignment,
    });
  });

  return [titlePara, ...bodyParas];
}

// ─── Helper: authorize ────────────────────────────────────────────────────────
async function getAuthorizedDoc(id: string, userId: string) {
  const doc = await CollabDocument.findById(id);
  if (!doc) return null;
  const ok =
    doc.ownerId.toString() === userId ||
    doc.collaborators.some((c) => c.userId.toString() === userId);
  return ok ? doc : false;
}

// ─── Export as DOCX ───────────────────────────────────────────────────────────
router.get('/:id/docx', async (req: AuthRequest, res: Response) => {
  try {
    const result = await getAuthorizedDoc(req.params.id, req.user!.sub);
    if (result === null) { res.status(404).json({ error: 'Not found' }); return; }
    if (result === false) { res.status(403).json({ error: 'Access denied' }); return; }

    const nodes = result.yjsState ? extractNodes(result.yjsState as Buffer) : [];
    const paragraphs = nodesToDocxParagraphs(result.title, nodes);

    const docx = new DocxDocument({ sections: [{ properties: {}, children: paragraphs }] });
    const buffer = await Packer.toBuffer(docx);

    const filename = `${result.title.replace(/[^a-z0-9]/gi, '_') || 'document'}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err) {
    logger.error({ err }, '[export/docx]');
    res.status(500).json({ error: 'DOCX export failed' });
  }
});

// ─── Export as PDF ────────────────────────────────────────────────────────────
router.get('/:id/pdf', async (req: AuthRequest, res: Response) => {
  try {
    logger.debug({ docId: req.params.id }, '[export/pdf] Starting PDF export');
    const result = await getAuthorizedDoc(req.params.id, req.user!.sub);
    if (result === null) { res.status(404).json({ error: 'Not found' }); return; }
    if (result === false) { res.status(403).json({ error: 'Access denied' }); return; }

    const nodes = result.yjsState ? extractNodes(result.yjsState as Buffer) : [];
    const filename = `${result.title.replace(/[^a-z0-9]/gi, '_') || 'document'}.pdf`;

    logger.debug('[export/pdf] Generating PDF');
    const doc = new PDFDocument({ bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
      logger.debug('[export/pdf] PDF export completed successfully');
    });

    doc.fontSize(24).font('Helvetica-Bold').text(result.title, { underline: true });
    doc.moveDown();

    nodes.forEach((node) => {
      if (node.type === 'heading') {
        const size = 20 - (node.level ?? 1) * 2;
        doc.fontSize(size).font('Helvetica-Bold').text(node.text);
        doc.moveDown(0.5);
      } else if (node.type === 'codeblock') {
        doc.fontSize(10).font('Courier').text(node.text, { lineBreak: true });
        doc.moveDown(0.5);
      } else {
        doc.fontSize(12).font('Helvetica').text(node.text || ' ', { lineBreak: true });
        doc.moveDown(0.3);
      }
    });

    doc.end();
  } catch (err) {
    logger.error({ err }, '[export/pdf] Error');
    res.status(500).json({ error: 'PDF export failed', details: (err as any)?.message });
  }
});

export default router;
