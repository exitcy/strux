'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { JSONContent } from '@tiptap/core';
import {
  Bot,
  Check,
  ClipboardCopy,
  Code2,
  Download,
  FileText,
  Printer,
  Sparkles,
  Terminal,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildExport,
  downloadFile,
  fetchOpenComments,
  htmlToMarkdown,
  jsonToMarkdown,
  slugify,
  type ExportFormat,
} from '@/lib/export';
import type { CommentRecord } from '@/lib/comments';
import { trackEvent } from '@/lib/telemetry';

interface ExportModalProps {
  documentId: string;
  title: string;
  getJSON: () => JSONContent;
  getHTML: () => string;
  userEmail?: string;
  /** Trigger button element (passed as DropdownMenuTrigger `render`). */
  children: ReactElement<{ children?: ReactNode }>;
}

type ExportAction = 'copy' | 'download';

type ExportOption = {
  id: ExportFormat;
  label: string;
  description: (slug: string) => string;
  icon: ReactNode;
  action: ExportAction;
  ActionIcon: typeof ClipboardCopy;
};

const IDE_OPTIONS: ExportOption[] = [
  {
    id: 'cursor-rule',
    label: 'Cursor Rule',
    description: (slug) => `Copies rule for .cursor/rules/${slug}.mdc`,
    icon: <Terminal className="size-4" />,
    action: 'copy',
    ActionIcon: ClipboardCopy,
  },
  {
    id: 'agents-md',
    label: 'AGENTS.md',
    description: () => 'Copies context for AGENTS.md',
    icon: <Bot className="size-4" />,
    action: 'copy',
    ActionIcon: ClipboardCopy,
  },
  {
    id: 'claude-md',
    label: 'CLAUDE.md',
    description: () => 'Copies context for CLAUDE.md',
    icon: <Code2 className="size-4" />,
    action: 'copy',
    ActionIcon: ClipboardCopy,
  },
  {
    id: 'ai-prompt',
    label: 'Copy AI Prompt',
    description: () => 'Copies prompt for any AI chat',
    icon: <Sparkles className="size-4" />,
    action: 'copy',
    ActionIcon: ClipboardCopy,
  },
];

const FILE_OPTIONS: ExportOption[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    description: (slug) => `Downloads ${slug}.md`,
    icon: <FileText className="size-4" />,
    action: 'download',
    ActionIcon: Download,
  },
  {
    id: 'pdf-html',
    label: 'Print / PDF',
    description: () => 'Opens print dialog',
    icon: <Printer className="size-4" />,
    action: 'download',
    ActionIcon: Printer,
  },
];

export default function ExportModal({
  documentId,
  title,
  getJSON,
  getHTML,
  userEmail,
  children,
}: ExportModalProps) {
  const [open, setOpen] = useState(false);
  const [openComments, setOpenComments] = useState<CommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<ExportFormat | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slug = useMemo(() => slugify(title), [title]);

  useEffect(() => {
    if (!open) return;
    setCopiedId(null);
    setCommentsLoading(true);
    void fetchOpenComments(documentId)
      .then(setOpenComments)
      .finally(() => setCommentsLoading(false));
  }, [open, documentId]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const getMarkdown = useCallback(() => {
    const json = getJSON();
    const md = jsonToMarkdown(json);
    if (md.trim()) return md;
    return htmlToMarkdown(getHTML());
  }, [getJSON, getHTML]);

  const runExport = useCallback(
    (format: ExportFormat, action: ExportAction) => {
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
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        closeTimerRef.current = setTimeout(() => {
          setOpen(false);
          setCopiedId(null);
        }, 1200);
      } else if (payload.filename) {
        downloadFile(payload.filename, payload.content, payload.mimeType);
        setOpen(false);
      } else if (format === 'pdf-html') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(payload.content);
          printWindow.document.close();
          printWindow.print();
        }
        setOpen(false);
      }

      void trackEvent('export_clicked', {
        documentId,
        format,
        action,
        openCommentCount: openComments.length,
      });
    },
    [documentId, getMarkdown, getHTML, title, userEmail, openComments]
  );

  const renderOption = (opt: ExportOption) => {
    const ActionIcon = opt.ActionIcon;
    const isCopied = copiedId === opt.id;

    return (
      <DropdownMenuItem
        key={opt.id}
        closeOnClick={opt.action === 'download'}
        onClick={() => runExport(opt.id, opt.action)}
        className="items-start gap-3 py-2"
      >
        <span className="mt-0.5 text-muted-foreground">{opt.icon}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{opt.label}</span>
          <span className="text-xs text-muted-foreground">{opt.description(slug)}</span>
        </div>
        {isCopied ? (
          <Check className="mt-0.5 size-3.5 text-foreground" />
        ) : (
          <ActionIcon className="mt-0.5 size-3.5 text-muted-foreground" />
        )}
      </DropdownMenuItem>
    );
  };

  const trigger = isValidElement(children) ? children : null;
  const triggerChildren = trigger?.props.children;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        setOpen(next);
        if (!next) setCopiedId(null);
      }}
    >
      {trigger && (
        <DropdownMenuTrigger render={trigger}>{triggerChildren}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>AI IDE & Rules</DropdownMenuLabel>
          {IDE_OPTIONS.map(renderOption)}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>Export Files</DropdownMenuLabel>
          {FILE_OPTIONS.map(renderOption)}
        </DropdownMenuGroup>

        {(commentsLoading || openComments.length > 0) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              {commentsLoading ? (
                <p className="text-xs text-muted-foreground">Loading open comments…</p>
              ) : (
                <Badge
                  variant="outline"
                  className="h-auto max-w-full whitespace-normal py-0.5 text-[10px] font-medium"
                >
                  {openComments.length} open review comment
                  {openComments.length !== 1 ? 's' : ''} included
                </Badge>
              )}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
