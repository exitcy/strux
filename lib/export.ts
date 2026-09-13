import type { JSONContent } from '@tiptap/core';
import TurndownService from 'turndown';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { mapCommentRow, type CommentRecord } from '@/lib/comments';

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled';
}

function applyMarks(text: string, marks?: JSONContent['marks']): string {
  if (!marks?.length) return text;
  let out = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        out = `**${out}**`;
        break;
      case 'italic':
        out = `*${out}*`;
        break;
      case 'code':
        out = `\`${out}\``;
        break;
      case 'strike':
        out = `~~${out}~~`;
        break;
      case 'link': {
        const href = (mark.attrs?.href as string) ?? '';
        out = `[${out}](${href})`;
        break;
      }
    }
  }
  return out;
}

function inlineContent(nodes?: JSONContent[]): string {
  if (!nodes?.length) return '';
  return nodes
    .map((n) => {
      if (n.type === 'text') return applyMarks(n.text ?? '', n.marks);
      if (n.type === 'hardBreak') return '\n';
      if (n.content) return inlineContent(n.content);
      return '';
    })
    .join('');
}

function nodeToMarkdown(node: JSONContent, depth = 0): string {
  switch (node.type) {
    case 'paragraph':
      return inlineContent(node.content);
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      return `${'#'.repeat(level)} ${inlineContent(node.content)}`;
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => {
          const text = (item.content ?? []).map((c) => nodeToMarkdown(c, depth + 1)).join('\n');
          return `- ${text.replace(/^- /, '')}`;
        })
        .join('\n');
    case 'orderedList':
      return (node.content ?? [])
        .map((item, i) => {
          const text = (item.content ?? []).map((c) => nodeToMarkdown(c, depth + 1)).join('\n');
          return `${i + 1}. ${text.replace(/^\d+\. /, '')}`;
        })
        .join('\n');
    case 'taskList':
      return (node.content ?? [])
        .map((item) => {
          const checked = item.attrs?.checked === true;
          const text = (item.content ?? []).map((c) => nodeToMarkdown(c, depth + 1)).join('\n');
          return `- [${checked ? 'x' : ' '}] ${text.replace(/^- \[[ x]\] /, '')}`;
        })
        .join('\n');
    case 'blockquote': {
      const inner = (node.content ?? []).map((c) => nodeToMarkdown(c, depth)).join('\n');
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }
    case 'codeBlock': {
      const lang = (node.attrs?.language as string) ?? '';
      const code = inlineContent(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case 'horizontalRule':
      return '---';
    case 'image': {
      const src = (node.attrs?.src as string) ?? '';
      const alt = (node.attrs?.alt as string) ?? 'image';
      return `![${alt}](${src})`;
    }
    case 'table': {
      const rows = node.content ?? [];
      if (!rows.length) return '';
      const lines: string[] = [];
      rows.forEach((row, rowIdx) => {
        const cells = (row.content ?? []).map((cell) => {
          const text = (cell.content ?? []).map((c) => nodeToMarkdown(c)).join(' ').replace(/\|/g, '\\|');
          return `| ${text.trim()} `;
        });
        lines.push(`${cells.join('')}|`);
        if (rowIdx === 0) {
          lines.push(`|${cells.map(() => ' --- ').join('')}|`);
        }
      });
      return lines.join('\n');
    }
    case 'listItem':
    case 'taskItem':
      return (node.content ?? []).map((c) => nodeToMarkdown(c, depth)).join('\n');
    default:
      if (node.content) {
        return node.content.map((c) => nodeToMarkdown(c, depth)).join('\n');
      }
      return '';
  }
}

/** Convert TipTap JSONContent to markdown (source of truth for exports). */
export function jsonToMarkdown(doc: JSONContent): string {
  const nodes = doc.content ?? [];
  return nodes.map((n) => nodeToMarkdown(n)).filter(Boolean).join('\n\n').trim();
}

/** Legacy HTML → markdown via Turndown (fallback). */
export function htmlToMarkdown(html: string): string {
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

export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchOpenComments(documentId: string): Promise<CommentRecord[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data
    .map((row: Record<string, unknown>) => mapCommentRow(row))
    .filter((c: CommentRecord) => !c.is_resolved && !c.parent_id);
}

function formatOpenQuestions(comments: CommentRecord[]): string {
  if (!comments.length) return '';
  const lines = comments.map(
    (c, i) =>
      `${i + 1}. **${c.user_email.split('@')[0]}**: ${c.content}${
        c.highlighted_text ? `\n   > Context: "${c.highlighted_text}"` : ''
      }`
  );
  return `\n\n## Open Questions\n\nThe following review comments are unresolved:\n\n${lines.join('\n\n')}`;
}

export type ExportFormat =
  | 'ai-prompt'
  | 'cursor-rule'
  | 'agents-md'
  | 'claude-md'
  | 'markdown'
  | 'pdf-html';

export type ExportPayload = {
  content: string;
  filename?: string;
  mimeType: string;
  setupPath?: string;
  setupHint?: string;
};

export function buildExport(
  format: ExportFormat,
  opts: {
    title: string;
    markdown: string;
    html?: string;
    userEmail?: string;
    openComments?: CommentRecord[];
  }
): ExportPayload {
  const { title, markdown, html, userEmail, openComments = [] } = opts;
  const slug = slugify(title);
  const date = new Date().toISOString().split('T')[0];
  const questions = formatOpenQuestions(openComments);

  switch (format) {
    case 'markdown':
      return {
        content: `# ${title}\n\n> Exported from Strux on ${date}\n\n${markdown}${questions}`,
        filename: `${slug}.md`,
        mimeType: 'text/markdown',
      };
    case 'pdf-html':
      return {
        content: `<!DOCTYPE html>
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
  ${html ?? ''}
</body></html>`,
        mimeType: 'text/html',
      };
    case 'ai-prompt':
      return {
        content: `# Design Specification: ${title}\n\n## Context\nThis is a design document authored by ${userEmail ?? 'unknown'} on ${date}.\n\n## Specification\n${markdown}${questions}\n\n## Instructions\nImplement the above specification. Follow the requirements exactly. Ask clarifying questions if any part of the spec is ambiguous.`,
        mimeType: 'text/plain',
        setupHint: 'Paste into Cursor, Claude, or any AI chat to start implementation.',
      };
    case 'cursor-rule':
      return {
        content: `---\ndescription: "Design spec: ${title}"\nglobs:\n  - "src/**"\n  - "app/**"\n  - "components/**"\nalwaysApply: false\n---\n\n# ${title}\n\n${markdown}${questions}\n\nWhen implementing code in this project, follow this design specification precisely.`,
        filename: `${slug}.mdc`,
        mimeType: 'text/markdown',
        setupPath: `.cursor/rules/${slug}.mdc`,
        setupHint: 'Save this file in your project root so Cursor applies it when editing matching files.',
      };
    case 'agents-md':
      return {
        content: `# ${title}\n\n> Design specification — exported from Strux on ${date}\n\n${markdown}${questions}\n\n---\n\nFollow this specification when implementing features in this codebase. Ask for clarification if any requirement is ambiguous.`,
        filename: 'AGENTS.md',
        mimeType: 'text/markdown',
        setupPath: 'AGENTS.md',
        setupHint: 'Place at your project root for Claude Code and agent workflows.',
      };
    case 'claude-md':
      return {
        content: `# ${title}\n\n> Design specification — exported from Strux on ${date}\n\n${markdown}${questions}\n\n---\n\n## Implementation Guidelines\n\n- Follow this specification when writing or modifying code\n- Preserve existing conventions in the codebase\n- Ask clarifying questions before making assumptions`,
        filename: 'CLAUDE.md',
        mimeType: 'text/markdown',
        setupPath: 'CLAUDE.md',
        setupHint: 'Place at your project root for Claude project instructions.',
      };
  }
}

export { slugify };
