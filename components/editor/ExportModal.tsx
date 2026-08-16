'use client';

import { useCallback, useEffect, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import {
  Bot,
  Check,
  ClipboardCopy,
  Code2,
  Download,
  FileText,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  buildExport,
  downloadFile,
  fetchOpenComments,
  htmlToMarkdown,
  jsonToMarkdown,
  type ExportFormat,
} from '@/lib/export';
import type { CommentRecord } from '@/lib/comments';
import { trackEvent } from '@/lib/telemetry';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  title: string;
  getJSON: () => JSONContent;
  getHTML: () => string;
  userEmail?: string;
}

type ExportOption = {
  id: ExportFormat;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  section: 'ide' | 'other';
};

const IDE_OPTIONS: ExportOption[] = [
  {
    id: 'cursor-rule',
    label: 'Cursor Rule',
    description: '.mdc file for Cursor IDE',
    icon: <Terminal className="size-4" />,
    badge: 'Cursor',
    section: 'ide',
  },
  {
    id: 'agents-md',
    label: 'AGENTS.md',
    description: 'Claude Code project file',
    icon: <Bot className="size-4" />,
    badge: 'Claude',
    section: 'ide',
  },
  {
    id: 'claude-md',
    label: 'CLAUDE.md',
    description: 'Claude project instructions',
    icon: <Code2 className="size-4" />,
    badge: 'Claude',
    section: 'ide',
  },
  {
    id: 'ai-prompt',
    label: 'Copy as AI Prompt',
    description: 'Paste into any AI chat',
    icon: <Sparkles className="size-4" />,
    badge: 'AI',
    section: 'ide',
  },
];

const OTHER_OPTIONS: ExportOption[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Download as .md file',
    icon: <FileText className="size-4" />,
    section: 'other',
  },
  {
    id: 'pdf-html',
    label: 'PDF',
    description: 'Print-ready document',
    icon: <FileText className="size-4" />,
    section: 'other',
  },
];

export default function ExportModal({
  open,
  onClose,
  documentId,
  title,
  getJSON,
  getHTML,
  userEmail,
}: ExportModalProps) {
  const [openComments, setOpenComments] = useState<CommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{
    format: ExportFormat;
    setupPath?: string;
    setupHint?: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLastAction(null);
    setCopiedId(null);
    setCommentsLoading(true);
    void fetchOpenComments(documentId)
      .then(setOpenComments)
      .finally(() => setCommentsLoading(false));
  }, [open, documentId]);

  const getMarkdown = useCallback(() => {
    const json = getJSON();
    const md = jsonToMarkdown(json);
    if (md.trim()) return md;
    return htmlToMarkdown(getHTML());
  }, [getJSON, getHTML]);

  const runExport = useCallback(
    (format: ExportFormat, action: 'copy' | 'download') => {
      const markdown = getMarkdown();
      const payload = buildExport(format, {
        title,
        markdown,
        html: getHTML(),
        userEmail,
        openComments,
      });

      if (action === 'copy') {
        void navigator.clipboard.writeText(payload.content);
        setCopiedId(format);
        setTimeout(() => setCopiedId(null), 2000);
      } else if (payload.filename) {
        downloadFile(payload.filename, payload.content, payload.mimeType);
      } else if (format === 'pdf-html') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(payload.content);
          printWindow.document.close();
          printWindow.print();
        }
      }

      void trackEvent('export_clicked', {
        documentId,
        format,
        action,
        openCommentCount: openComments.length,
      });

      setLastAction({
        format,
        setupPath: payload.setupPath,
        setupHint: payload.setupHint,
      });
    },
    [documentId, getMarkdown, getHTML, title, userEmail, openComments]
  );

  const renderOption = (opt: ExportOption) => (
    <div
      key={opt.id}
      className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {opt.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{opt.label}</p>
          {opt.badge && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              {opt.badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{opt.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Copy to clipboard"
          onClick={() => runExport(opt.id, 'copy')}
        >
          {copiedId === opt.id ? (
            <Check className="size-3.5 text-green-600" />
          ) : (
            <ClipboardCopy className="size-3.5" />
          )}
        </Button>
        {(opt.id !== 'ai-prompt') && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Download file"
            onClick={() => runExport(opt.id, 'download')}
          >
            <Download className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Ship to IDE</DialogTitle>
          <DialogDescription>
            Export &ldquo;{title}&rdquo; for Cursor, Claude, or any AI coding tool.
            {commentsLoading && (
              <span className="mt-1 block text-muted-foreground">Loading open comments…</span>
            )}
            {!commentsLoading && openComments.length > 0 && (
              <span className="mt-1 block text-amber-600">
                {openComments.length} open review comment{openComments.length !== 1 ? 's' : ''} will be included.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-4">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              className="h-auto flex-col items-start gap-1 py-3"
              onClick={() => runExport('cursor-rule', 'copy')}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Terminal className="size-3.5" />
                Copy for Cursor
              </span>
              <span className="text-[10px] font-normal text-primary-foreground/80">
                Paste into .cursor/rules/
              </span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-auto flex-col items-start gap-1 py-3"
              onClick={() => runExport('agents-md', 'copy')}
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Bot className="size-3.5" />
                Copy for Claude
              </span>
              <span className="text-[10px] font-normal text-secondary-foreground/80">
                Paste into AGENTS.md
              </span>
            </Button>
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            AI & IDE
          </p>
          <div className="space-y-2">{IDE_OPTIONS.map(renderOption)}</div>

          <Separator className="my-4" />

          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Other formats
          </p>
          <div className="space-y-2">{OTHER_OPTIONS.map(renderOption)}</div>
        </div>

        {lastAction?.setupPath && (
          <div className="border-t bg-muted/40 px-6 py-4">
            <p className="text-xs font-medium text-foreground">Setup instructions</p>
            <p className="mt-1 text-xs text-muted-foreground">{lastAction.setupHint}</p>
            <div className="mt-2 flex items-center gap-2 rounded-md border bg-background px-3 py-2">
              <code className="flex-1 truncate text-xs">{lastAction.setupPath}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  void navigator.clipboard.writeText(lastAction.setupPath ?? '');
                  setCopiedId('path');
                  setTimeout(() => setCopiedId(null), 2000);
                }}
              >
                {copiedId === 'path' ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <ClipboardCopy className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        )}

        {lastAction?.setupHint && !lastAction.setupPath && (
          <div className="border-t bg-muted/40 px-6 py-4">
            <p className="text-xs text-muted-foreground">{lastAction.setupHint}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
