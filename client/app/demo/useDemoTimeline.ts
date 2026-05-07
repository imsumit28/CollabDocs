'use client';

import { useEffect, useMemo, useState } from 'react';

const TITLE = 'Project Roadmap 2026';
const DRAFT_TEXT = `Q1 Goals:
- Improve collaboration latency
- Add AI summarization
- Improve export system`;
const IMPROVED_TEXT = `Q1 Goals:
- Reduce collaboration latency across every workspace
- Ship AI summaries for meetings, notes, and roadmap updates
- Polish exports for PDF, DOCX, and Markdown`;
const LOOP_MS = 20500;

type ToastTone = 'success' | 'info';

export interface DemoToast {
  id: string;
  message: string;
  tone: ToastTone;
}

function typedSlice(text: string, elapsed: number, start: number, speed: number) {
  if (elapsed < start) return '';
  return text.slice(0, Math.min(text.length, Math.floor((elapsed - start) / speed)));
}

export function useDemoTimeline() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsed((Date.now() - startedAt) % LOOP_MS);
    }, 50);

    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const improved = elapsed >= 11200;
    const collaboratorJoined = elapsed >= 3300;
    const secondCursor = elapsed >= 4550;
    const commentVisible = elapsed >= 6500;
    const selectionVisible = elapsed >= 8400;
    const toolbarVisible = elapsed >= 9150;
    const toolbarClicked = elapsed >= 10350;
    const exportOpen = elapsed >= 13600;
    const exporting = elapsed >= 14900 && elapsed < 16600;
    const exportDone = elapsed >= 16600;
    const typedTitle = typedSlice(TITLE, elapsed, 420, 58);
    const typedBody = improved ? IMPROVED_TEXT : typedSlice(DRAFT_TEXT, elapsed, 1650, 34);
    const cursorStep = secondCursor ? Math.floor(Math.max(0, elapsed - 4700) / 1450) % 4 : 0;

    const toasts: DemoToast[] = [];
    if (elapsed >= 11200) toasts.push({ id: 'ai', message: 'AI suggestion applied', tone: 'success' });
    if (elapsed >= 12300) toasts.push({ id: 'sync', message: 'Changes synced', tone: 'success' });
    if (elapsed >= 14900) toasts.push({ id: 'ready', message: 'Export ready', tone: 'info' });

    let progress = 2;
    if (typedTitle) progress = 8;
    if (typedBody) progress = 18;
    if (secondCursor) progress = 26;
    if (commentVisible) progress = 38;
    if (toolbarVisible) progress = 50;
    if (improved) progress = 62;
    if (exportOpen) progress = 72;
    if (exporting) progress = 86;
    if (exportDone) progress = 100;

    return {
      typedTitle,
      typedBody,
      collaboratorJoined,
      secondCursor,
      cursorStep,
      commentVisible,
      selectionVisible,
      toolbarVisible,
      toolbarClicked,
      improved,
      exportOpen,
      exporting,
      exportDone,
      toasts,
      progress,
    };
  }, [elapsed]);
}
