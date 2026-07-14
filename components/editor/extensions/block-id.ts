import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/** Block types that receive a stable `blockId` for comment / AI anchors. */
const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
] as const;

function newBlockId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `blk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
}

/**
 * Assigns `blockId` on block nodes so comments can point at Yjs-synced blocks
 * instead of brittle plain-text snapshots alone.
 */
export const BlockId = Extension.create({
  name: 'blockId',
  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_TYPES],
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-block-id'),
            renderHTML: (attributes) => {
              if (!attributes.blockId) return {};
              return { 'data-block-id': String(attributes.blockId) };
            },
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockIdAssigner'),
        appendTransaction: (_transactions, _oldState, newState) => {
          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (
              node.isBlock &&
              (BLOCK_TYPES as readonly string[]).includes(node.type.name) &&
              !node.attrs.blockId
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                blockId: newBlockId(),
              });
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
