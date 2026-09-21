import { describe, expect, it } from 'vitest';
import {
  buildExport,
  escapeHtml,
  escapeYamlDoubleQuoted,
  jsonToMarkdown,
  sanitizeExportHtml,
} from '@/lib/export';
import { safeAuthNextPath } from '@/lib/auth-redirect';
import { getTemplate } from '@/lib/templates';

describe('jsonToMarkdown', () => {
  it('converts headings and paragraphs', () => {
    const md = jsonToMarkdown({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
      ],
    });
    expect(md).toContain('# Title');
    expect(md).toContain('Body text');
  });

  it('converts task lists', () => {
    const md = jsonToMarkdown({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Todo' }] }],
            },
          ],
        },
      ],
    });
    expect(md).toContain('- [ ] Todo');
  });
});

describe('safeAuthNextPath', () => {
  it('allows relative same-origin paths', () => {
    expect(safeAuthNextPath('/dashboard')).toBe('/dashboard');
    expect(safeAuthNextPath('/doc/abc')).toBe('/doc/abc');
  });

  it('rejects open redirects', () => {
    expect(safeAuthNextPath('//evil.example/phish')).toBe('/dashboard');
    expect(safeAuthNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeAuthNextPath('/\\evil.example')).toBe('/dashboard');
    expect(safeAuthNextPath(null)).toBe('/dashboard');
  });
});

describe('export sanitization', () => {
  it('escapes html in titles for print export', () => {
    const payload = buildExport('pdf-html', {
      title: '<script>alert(1)</script>',
      markdown: 'body',
      html: '<p onclick="alert(1)">hi</p><script>alert(2)</script>',
    });
    expect(payload.content).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(payload.content).not.toContain('<script>alert(2)</script>');
    expect(payload.content).not.toContain('onclick=');
    expect(payload.content).toContain('<p>hi</p>');
  });

  it('neutralizes yaml injection in cursor-rule frontmatter', () => {
    const payload = buildExport('cursor-rule', {
      title: 'foo"\nalwaysApply: true\nglobs:\n  - "**/*"\ndescription: "x',
      markdown: '## Spec',
    });
    const frontmatter = payload.content.slice(0, payload.content.indexOf('\n---\n', 4) + 4);
    expect(frontmatter).toContain('alwaysApply: false');
    expect(frontmatter).not.toMatch(/^alwaysApply: true$/m);
    expect(frontmatter).toContain('\\"');
    expect(escapeYamlDoubleQuoted('a"b\nc')).toBe('a\\"b c');
  });

  it('escapeHtml and sanitizeExportHtml helpers', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    expect(sanitizeExportHtml('<a href="javascript:alert(1)">x</a>')).toContain('href="#"');
  });
});

describe('buildExport', () => {
  it('builds cursor rule with open questions', () => {
    const payload = buildExport('cursor-rule', {
      title: 'Auth API',
      markdown: '## Spec\nDo the thing',
      openComments: [
        {
          id: '1',
          document_id: 'd',
          user_id: 'u',
          user_email: 'dev@co.com',
          content: 'What about rate limits?',
          highlighted_text: null,
          block_id: null,
          is_resolved: false,
          parent_id: null,
          created_at: new Date().toISOString(),
        },
      ],
    });
    expect(payload.content).toContain('Auth API');
    expect(payload.content).toContain('globs:');
    expect(payload.content).toContain('Open Questions');
    expect(payload.content).toContain('rate limits');
    expect(payload.setupPath).toBe('.cursor/rules/auth-api.mdc');
  });

  it('builds agents-md for Claude', () => {
    const payload = buildExport('agents-md', {
      title: 'Payments',
      markdown: 'Charge users monthly',
    });
    expect(payload.filename).toBe('AGENTS.md');
    expect(payload.content).toContain('Payments');
    expect(payload.setupPath).toBe('AGENTS.md');
  });
});

describe('templates', () => {
  it('returns design doc template with sections', () => {
    const t = getTemplate('design-doc');
    expect(t.defaultTitle).toBe('Design doc');
    const text = JSON.stringify(t.content);
    expect(text).toContain('Context');
    expect(text).toContain('Open questions');
  });

  it('falls back to blank for unknown id', () => {
    const t = getTemplate('blank');
    expect(t.id).toBe('blank');
  });
});
