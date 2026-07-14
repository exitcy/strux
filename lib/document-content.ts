import type { JSONContent } from '@tiptap/core';

/** Extract plain text from a top-level TipTap block node. */
export function blockText(node: JSONContent): string {
  const walk = (nodes: JSONContent[] | undefined): string => {
    if (!nodes) return '';
    return nodes
      .map((n) => {
        if (n.type === 'text') return n.text ?? '';
        if (n.content) return walk(n.content);
        return '';
      })
      .join('');
  };
  return walk(node.content);
}

/** Find the top-level block index containing `text` (same logic as editor getNodeIndex). */
export function findNodeIndexByText(content: JSONContent, text: string): number {
  if (!text.trim()) return 0;
  const nodes = content.content ?? [];
  for (let i = 0; i < nodes.length; i++) {
    const nodeText = blockText(nodes[i]);
    if (nodeText.includes(text) || text.includes(nodeText)) {
      return i;
    }
  }
  return 0;
}

function nodeContainsBlockId(node: JSONContent, blockId: string): boolean {
  if (node.attrs?.blockId === blockId) return true;
  for (const child of node.content ?? []) {
    if (nodeContainsBlockId(child, blockId)) return true;
  }
  return false;
}

/** Top-level block index for a TipTap `blockId` attribute. */
export function findNodeIndexByBlockId(content: JSONContent, blockId: string): number {
  if (!blockId) return -1;
  const nodes = content.content ?? [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodeContainsBlockId(nodes[i], blockId)) return i;
  }
  return -1;
}

export function getBlockTextById(content: JSONContent, blockId: string): string | null {
  const idx = findNodeIndexByBlockId(content, blockId);
  if (idx < 0) return null;
  const text = blockText((content.content ?? [])[idx]);
  return text || null;
}

/** Replace a top-level block's inline text with the AI proposal (preserves block type). */
export function applyProposedTextAtNodeIndex(
  content: JSONContent,
  nodeIndex: number,
  proposedText: string
): JSONContent {
  const next = JSON.parse(JSON.stringify(content)) as JSONContent;
  const nodes = next.content ?? [];
  if (nodeIndex < 0 || nodeIndex >= nodes.length) return next;

  const node = nodes[nodeIndex];
  if (node.content && node.content.length > 0) {
    node.content = [{ type: 'text', text: proposedText }];
  } else {
    node.content = [{ type: 'text', text: proposedText }];
  }
  return next;
}

export function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
}
