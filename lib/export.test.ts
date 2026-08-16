import { describe, expect, it } from 'vitest';
import { buildExport, jsonToMarkdown } from '@/lib/export';
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
