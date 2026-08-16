import type { JSONContent } from '@tiptap/core';

export type DocumentTemplateId = 'blank' | 'design-doc' | 'adr' | 'api-rfc';

export type DocumentTemplate = {
  id: DocumentTemplateId;
  label: string;
  description: string;
  defaultTitle: string;
  content: JSONContent;
};

function heading(level: 1 | 2 | 3, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function para(text = ''): JSONContent {
  return text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph', content: [] };
}

function bulletItem(text: string): JSONContent {
  return {
    type: 'listItem',
    content: [para(text)],
  };
}

function bulletList(items: string[]): JSONContent {
  return {
    type: 'bulletList',
    content: items.map(bulletItem),
  };
}

function task(text: string, checked = false): JSONContent {
  return {
    type: 'taskItem',
    attrs: { checked },
    content: [para(text)],
  };
}

function taskList(items: { text: string; checked?: boolean }[]): JSONContent {
  return {
    type: 'taskList',
    content: items.map((i) => task(i.text, i.checked ?? false)),
  };
}

const DESIGN_DOC: JSONContent = {
  type: 'doc',
  content: [
    heading(1, 'Design doc title'),
    para('One-line summary of what this spec covers.'),
    heading(2, 'Context'),
    para('What problem are we solving? Who is affected?'),
    heading(2, 'Goals'),
    bulletList(['Primary goal', 'Secondary goal']),
    heading(2, 'Non-goals'),
    bulletList(['Explicitly out of scope']),
    heading(2, 'Proposal'),
    para('Describe the recommended approach.'),
    heading(3, 'API / interface'),
    para('Endpoints, types, or contracts.'),
    heading(3, 'Data model'),
    para('Tables, entities, or state changes.'),
    heading(2, 'Alternatives considered'),
    bulletList(['Alternative A — rejected because…', 'Alternative B — rejected because…']),
    heading(2, 'Open questions'),
    taskList([
      { text: 'Unresolved decision or review item' },
      { text: 'Dependency or rollout question' },
    ]),
    heading(2, 'Rollout'),
    bulletList(['Migration steps', 'Feature flags', 'Monitoring / success metrics']),
  ],
};

const ADR: JSONContent = {
  type: 'doc',
  content: [
    heading(1, 'ADR: Decision title'),
    para('Status: Proposed'),
    heading(2, 'Context'),
    para('What forces are at play? What constraints exist?'),
    heading(2, 'Decision'),
    para('We will…'),
    heading(2, 'Consequences'),
    bulletList(['Positive outcome', 'Trade-off or risk to monitor']),
  ],
};

const API_RFC: JSONContent = {
  type: 'doc',
  content: [
    heading(1, 'API / RFC title'),
    para('Brief summary of the API or system change.'),
    heading(2, 'Problem'),
    para('What user or system need does this address?'),
    heading(2, 'Specification'),
    heading(3, 'Request'),
    { type: 'codeBlock', attrs: { language: 'json' }, content: [{ type: 'text', text: '{\n  "example": true\n}' }] },
    heading(3, 'Response'),
    { type: 'codeBlock', attrs: { language: 'json' }, content: [{ type: 'text', text: '{\n  "result": "ok"\n}' }] },
    heading(2, 'Errors'),
    bulletList(['400 — invalid input', '404 — resource not found', '500 — server error']),
    heading(2, 'Migration'),
    para('Backwards compatibility, rollout plan, and rollback.'),
  ],
};

const BLANK: JSONContent = {
  type: 'doc',
  content: [para()],
};

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'design-doc',
    label: 'Design doc',
    description: 'Context, goals, proposal, alternatives, rollout',
    defaultTitle: 'Design doc',
    content: DESIGN_DOC,
  },
  {
    id: 'adr',
    label: 'ADR',
    description: 'Architecture decision record',
    defaultTitle: 'ADR',
    content: ADR,
  },
  {
    id: 'api-rfc',
    label: 'API / RFC',
    description: 'Problem, spec, errors, migration',
    defaultTitle: 'API RFC',
    content: API_RFC,
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Start from scratch',
    defaultTitle: 'Untitled',
    content: BLANK,
  },
];

export function getTemplate(id: DocumentTemplateId): DocumentTemplate {
  return DOCUMENT_TEMPLATES.find((t) => t.id === id) ?? DOCUMENT_TEMPLATES[DOCUMENT_TEMPLATES.length - 1];
}
