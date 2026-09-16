import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type Decoration as DecorationType, type EditorView } from '@tiptap/pm/view';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';

export type InlineSuggestionProposal = {
  id: string;
  blockId?: string | null;
  nodeIndex: number;
  originalText: string;
  proposedText: string;
};

type InlineSuggestionMeta =
  | { type: 'set'; proposal: InlineSuggestionProposal; scroll?: boolean }
  | { type: 'clear'; id: string }
  | { type: 'clearAll' }
  | { type: 'sync'; proposals: InlineSuggestionProposal[] }
  | { type: 'focus'; id: string };

type InlineSuggestionState = {
  proposals: InlineSuggestionProposal[];
  decorations: DecorationSet;
  focusId: string | null;
};

export const inlineSuggestionPluginKey = new PluginKey<InlineSuggestionState>('inlineSuggestion');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineSuggestion: {
      setInlineSuggestion: (proposal: InlineSuggestionProposal, scroll?: boolean) => ReturnType;
      clearInlineSuggestion: (id: string) => ReturnType;
      clearAllInlineSuggestions: () => ReturnType;
      syncInlineSuggestions: (proposals: InlineSuggestionProposal[]) => ReturnType;
      focusInlineSuggestion: (id: string) => ReturnType;
    };
  }
}

function findBlockById(
  doc: ProseMirrorNode,
  blockId: string
): { pos: number; node: ProseMirrorNode } | null {
  let found: { pos: number; node: ProseMirrorNode } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.isBlock && node.attrs.blockId === blockId) {
      found = { pos, node };
      return false;
    }
  });
  return found;
}

function findTopLevelBlock(
  doc: ProseMirrorNode,
  nodeIndex: number
): { pos: number; node: ProseMirrorNode } | null {
  if (nodeIndex < 0 || nodeIndex >= doc.childCount) return null;
  let pos = 0;
  for (let i = 0; i < nodeIndex; i++) {
    pos += doc.child(i).nodeSize;
  }
  return { pos, node: doc.child(nodeIndex) };
}

function findTextRange(
  doc: ProseMirrorNode,
  needle: string
): { from: number; to: number } | null {
  if (!needle.trim()) return null;
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;
    const idx = node.text.indexOf(needle);
    if (idx >= 0) {
      found = { from: pos + idx, to: pos + idx + needle.length };
    }
  });
  return found;
}

/** Resolve the content range to decorate for a proposal. */
export function resolveProposalRange(
  doc: ProseMirrorNode,
  proposal: InlineSuggestionProposal
): { from: number; to: number } | null {
  if (proposal.blockId) {
    const block = findBlockById(doc, proposal.blockId);
    if (block) {
      if (block.node.inlineContent) {
        return { from: block.pos + 1, to: block.pos + block.node.nodeSize - 1 };
      }
      // Prefer first inline-content child (e.g. paragraph inside listItem)
      let inner: { from: number; to: number } | null = null;
      block.node.descendants((child, relPos) => {
        if (inner) return false;
        if (child.inlineContent) {
          const abs = block.pos + 1 + relPos;
          inner = { from: abs + 1, to: abs + child.nodeSize - 1 };
          return false;
        }
      });
      if (inner) return inner;
      return { from: block.pos + 1, to: block.pos + block.node.nodeSize - 1 };
    }
  }

  const top = findTopLevelBlock(doc, proposal.nodeIndex);
  if (top) {
    if (top.node.inlineContent) {
      return { from: top.pos + 1, to: top.pos + top.node.nodeSize - 1 };
    }
    let inner: { from: number; to: number } | null = null;
    top.node.descendants((child, relPos) => {
      if (inner) return false;
      if (child.inlineContent) {
        const abs = top.pos + 1 + relPos;
        inner = { from: abs + 1, to: abs + child.nodeSize - 1 };
        return false;
      }
    });
    if (inner) return inner;
  }

  return findTextRange(doc, proposal.originalText);
}

function createControlsWidget(
  proposal: InlineSuggestionProposal,
  options: {
    onAccept: ((id: string, proposedText: string) => void) | null;
    onReject: ((id: string) => void) | null;
  }
): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'inline-suggestion-widget';
  wrap.contentEditable = 'false';

  const added = document.createElement('span');
  added.className = 'inline-suggestion-added';
  added.textContent = proposal.proposedText;
  wrap.appendChild(added);

  const controls = document.createElement('span');
  controls.className = 'inline-suggestion-controls';

  const acceptBtn = document.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className = 'inline-suggestion-accept';
  acceptBtn.textContent = 'Accept';
  acceptBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  acceptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onAccept?.(proposal.id, proposal.proposedText);
  });

  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.className = 'inline-suggestion-reject';
  rejectBtn.textContent = 'Reject';
  rejectBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  rejectBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onReject?.(proposal.id);
  });

  controls.appendChild(acceptBtn);
  controls.appendChild(rejectBtn);
  wrap.appendChild(controls);
  return wrap;
}

function buildDecorations(
  doc: ProseMirrorNode,
  proposals: InlineSuggestionProposal[],
  options: {
    onAccept: ((id: string, proposedText: string) => void) | null;
    onReject: ((id: string) => void) | null;
  }
): DecorationSet {
  const decos: DecorationType[] = [];

  for (const proposal of proposals) {
    const range = resolveProposalRange(doc, proposal);
    if (!range || range.from >= range.to) {
      // Still show widget at a fallback position via original text search end
      const fallback = findTextRange(doc, proposal.originalText);
      if (!fallback) continue;
      decos.push(
        Decoration.inline(fallback.from, fallback.to, { class: 'inline-suggestion-removed' }),
        Decoration.widget(fallback.to, () => createControlsWidget(proposal, options), {
          side: 1,
          key: `inline-suggestion-${proposal.id}`,
        })
      );
      continue;
    }

    decos.push(
      Decoration.inline(range.from, range.to, { class: 'inline-suggestion-removed' }),
      Decoration.widget(range.to, () => createControlsWidget(proposal, options), {
        side: 1,
        key: `inline-suggestion-${proposal.id}`,
      })
    );
  }

  return DecorationSet.create(doc, decos);
}

function scrollProposalIntoView(view: EditorView, proposal: InlineSuggestionProposal) {
  const range = resolveProposalRange(view.state.doc, proposal);
  if (!range) return;
  try {
    const start = view.domAtPos(range.from);
    const node =
      start.node instanceof HTMLElement ? start.node : start.node.parentElement;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  } catch {
    // ignore scroll failures
  }
}

/**
 * Apply proposed text to a block via a targeted ProseMirror transaction
 * (flows through Collaboration → Yjs). Prefers blockId, else top-level nodeIndex.
 */
export function applyProposedTextToEditor(
  editor: Editor,
  nodeIndex: number,
  proposedText: string,
  blockId?: string | null
): boolean {
  const { state } = editor;
  const { doc, schema } = state;

  let targetPos = -1;
  let targetNode: ProseMirrorNode | null = null;

  if (blockId) {
    const found = findBlockById(doc, blockId);
    if (found) {
      targetPos = found.pos;
      targetNode = found.node;
    }
  }

  if (!targetNode) {
    const top = findTopLevelBlock(doc, nodeIndex);
    if (!top) return false;
    targetPos = top.pos;
    targetNode = top.node;
  }

  // Replace innermost inline-content node when the target is a wrapper (listItem, etc.)
  let replacePos = targetPos;
  let replaceNode = targetNode;
  if (!targetNode.inlineContent) {
    let foundInner = false;
    targetNode.descendants((child, relPos) => {
      if (foundInner) return false;
      if (child.inlineContent) {
        replaceNode = child;
        replacePos = targetPos + 1 + relPos;
        foundInner = true;
        return false;
      }
    });
  }

  const from = replacePos + 1;
  const to = replacePos + replaceNode.nodeSize - 1;
  const content = proposedText ? schema.text(proposedText) : Fragment.empty;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (from > to) return false;
      tr.replaceWith(from, to, content);
      dispatch?.(tr);
      return true;
    })
    .run();
}

export const InlineSuggestion = Extension.create<{
  onAccept: ((id: string, proposedText: string) => void) | null;
  onReject: ((id: string) => void) | null;
}>({
  name: 'inlineSuggestion',

  addOptions() {
    return {
      onAccept: null,
      onReject: null,
    };
  },

  addCommands() {
    return {
      setInlineSuggestion:
        (proposal, scroll = true) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(inlineSuggestionPluginKey, { type: 'set', proposal, scroll } satisfies InlineSuggestionMeta));
          }
          return true;
        },
      clearInlineSuggestion:
        (id) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(inlineSuggestionPluginKey, { type: 'clear', id } satisfies InlineSuggestionMeta));
          }
          return true;
        },
      clearAllInlineSuggestions:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(inlineSuggestionPluginKey, { type: 'clearAll' } satisfies InlineSuggestionMeta));
          }
          return true;
        },
      syncInlineSuggestions:
        (proposals) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(inlineSuggestionPluginKey, { type: 'sync', proposals } satisfies InlineSuggestionMeta));
          }
          return true;
        },
      focusInlineSuggestion:
        (id) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(inlineSuggestionPluginKey, { type: 'focus', id } satisfies InlineSuggestionMeta));
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin<InlineSuggestionState>({
        key: inlineSuggestionPluginKey,
        state: {
          init: (_, state) => ({
            proposals: [],
            decorations: DecorationSet.empty,
            focusId: null,
          }),
          apply(tr, pluginState, _oldState, newState) {
            const meta = tr.getMeta(inlineSuggestionPluginKey) as InlineSuggestionMeta | undefined;
            let proposals = pluginState.proposals;
            let focusId = pluginState.focusId;

            if (meta?.type === 'set') {
              const rest = proposals.filter((p) => p.id !== meta.proposal.id);
              proposals = [...rest, meta.proposal];
              if (meta.scroll) focusId = meta.proposal.id;
            } else if (meta?.type === 'clear') {
              proposals = proposals.filter((p) => p.id !== meta.id);
              if (focusId === meta.id) focusId = null;
            } else if (meta?.type === 'clearAll') {
              proposals = [];
              focusId = null;
            } else if (meta?.type === 'sync') {
              proposals = meta.proposals;
            } else if (meta?.type === 'focus') {
              focusId = meta.id;
            }

            const decorations = buildDecorations(newState.doc, proposals, {
              onAccept: extension.options.onAccept,
              onReject: extension.options.onReject,
            });

            return { proposals, decorations, focusId };
          },
        },
        props: {
          decorations(state) {
            return inlineSuggestionPluginKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
        view: () => ({
          update(view, prevState) {
            const prev = inlineSuggestionPluginKey.getState(prevState);
            const next = inlineSuggestionPluginKey.getState(view.state);
            if (!next?.focusId) return;
            if (prev?.focusId === next.focusId && prev.proposals === next.proposals) return;
            const proposal = next.proposals.find((p) => p.id === next.focusId);
            if (proposal) {
              // Defer so decorations are painted
              requestAnimationFrame(() => scrollProposalIntoView(view, proposal));
            }
          },
        }),
      }),
    ];
  },
});
