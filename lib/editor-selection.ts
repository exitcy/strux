import type { Editor } from '@tiptap/react';

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
]);

/** Block id of the innermost block at the current selection (for new comments). */
export function findBlockIdAtSelection(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.isBlock && BLOCK_TYPES.has(node.type.name)) {
      const id = node.attrs.blockId as string | null | undefined;
      if (id) return id;
    }
  }
  return null;
}

/** Select and scroll to the first occurrence of `needle` in the document. */
export function highlightTextInEditor(editor: Editor, needle: string): boolean {
  if (!needle.trim()) return false;

  const doc = editor.state.doc;
  let foundFrom = -1;
  let foundTo = -1;

  doc.descendants((node, pos) => {
    if (foundFrom >= 0 || !node.isText || !node.text) return;
    const idx = node.text.indexOf(needle);
    if (idx >= 0) {
      foundFrom = pos + idx;
      foundTo = foundFrom + needle.length;
    }
  });

  if (foundFrom < 0) return false;

  editor
    .chain()
    .focus()
    .setTextSelection({ from: foundFrom, to: foundTo })
    .scrollIntoView()
    .run();

  return true;
}
