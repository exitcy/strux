'use client';

import { useState } from 'react';
import TurndownService from 'turndown';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  getHTML: () => string;
  userEmail?: string;
}

function htmlToMarkdown(html: string): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  td.addRule('taskList', {
    filter: (node) =>
      node.nodeName === 'LI' && node.parentElement?.getAttribute('data-type') === 'taskList',
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute('data-checked') === 'true';
      return `${checked ? '- [x]' : '- [ ]'} ${content.trim()}\n`;
    },
  });
  return td.turndown(html);
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled';
}

type ExportOption = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
};

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'markdown',
    label: 'Markdown',
    description: 'Download as .md file',
    icon: <span className="text-sm font-bold font-mono">MD</span>,
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Print-ready document',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    id: 'ai-prompt',
    label: 'Copy as AI Prompt',
    description: 'Paste into any AI chat',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
      </svg>
    ),
    badge: 'AI',
  },
  {
    id: 'cursor-rule',
    label: 'Cursor Rule',
    description: 'Download .cursor/rules/ file',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    badge: 'IDE',
  },
  {
    id: 'agents-md',
    label: 'AGENTS.md',
    description: 'For Claude Code projects',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    badge: 'IDE',
  },
];

export default function ExportModal({
  isOpen,
  onClose,
  title,
  getHTML,
  userEmail,
}: ExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleExport = (optionId: string) => {
    const html = getHTML();
    const markdown = htmlToMarkdown(html);
    const slug = slugify(title);
    const date = new Date().toISOString().split('T')[0];

    switch (optionId) {
      case 'markdown': {
        downloadFile(`${slug}.md`, markdown, 'text/markdown');
        onClose();
        break;
      }
      case 'pdf': {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html><head>
              <title>${title}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.7; }
                h1 { font-size: 2rem; margin-bottom: 0.5rem; }
                h2 { font-size: 1.5rem; margin-top: 2rem; }
                h3 { font-size: 1.25rem; margin-top: 1.5rem; }
                pre { background: #f4f4f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
                code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
                pre code { background: none; padding: 0; }
                blockquote { border-left: 3px solid #e4e4e7; padding-left: 1rem; color: #52525b; font-style: italic; }
                table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
                td, th { border: 1px solid #e4e4e7; padding: 8px 12px; text-align: left; }
                th { background: #f4f4f5; font-weight: 600; }
                img { max-width: 100%; }
                hr { border: none; border-top: 2px solid #e4e4e7; margin: 2rem 0; }
                a { color: #2563eb; }
                .meta { color: #71717a; font-size: 0.875rem; margin-bottom: 2rem; }
              </style>
            </head><body>
              <h1>${title}</h1>
              <p class="meta">Exported from Strux on ${date}</p>
              ${html}
            </body></html>
          `);
          printWindow.document.close();
          printWindow.print();
        }
        onClose();
        break;
      }
      case 'ai-prompt': {
        const prompt = `# Design Specification: ${title}\n\n## Context\nThis is a design document authored by ${userEmail ?? 'unknown'} on ${date}.\n\n## Specification\n${markdown}\n\n## Instructions\nImplement the above specification. Follow the requirements exactly. Ask clarifying questions if any part of the spec is ambiguous.`;
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => { setCopied(false); onClose(); }, 1500);
        break;
      }
      case 'cursor-rule': {
        const cursorRule = `---\ndescription: "Design spec: ${title}"\nglobs:\n  - "src/**"\n  - "app/**"\n  - "components/**"\nalwaysApply: false\n---\n\n# ${title}\n\n${markdown}\n\nWhen implementing code in this project, follow this design specification precisely.`;
        downloadFile(`${slug}.mdc`, cursorRule, 'text/markdown');
        onClose();
        break;
      }
      case 'agents-md': {
        const agentsMd = `# ${title}\n\n> Design specification — exported from Strux on ${date}\n\n${markdown}\n\n---\n\nFollow this specification when implementing features in this codebase. Ask for clarification if any requirement is ambiguous.`;
        downloadFile('AGENTS.md', agentsMd, 'text/markdown');
        onClose();
        break;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-gray-900">Export</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500">Choose an export format for &ldquo;{title}&rdquo;</p>
        </div>

        <div className="px-4 pb-5 space-y-1">
          {EXPORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleExport(opt.id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left
                         hover:bg-gray-50 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors flex-shrink-0">
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                  {opt.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-600">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{opt.description}</p>
              </div>
              {opt.id === 'ai-prompt' && copied ? (
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
