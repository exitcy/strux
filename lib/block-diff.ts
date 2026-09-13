import type { JSONContent } from "@tiptap/core";

export interface DiffBlock {
  id: string | null;
  type: string;
  text: string;
}

export type BlockDiffOp =
  | { op: "equal"; left: DiffBlock; right: DiffBlock }
  | { op: "modified"; left: DiffBlock; right: DiffBlock }
  | { op: "added"; right: DiffBlock }
  | { op: "removed"; left: DiffBlock };

function walkInline(nodes: JSONContent[] | undefined): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.content) return walkInline(node.content);
      return "";
    })
    .join("");
}

function blockIdForNode(node: JSONContent): string | null {
  const id = node.attrs?.blockId;
  return typeof id === "string" && id.trim() ? id : null;
}

export function extractDiffBlocks(content: JSONContent | null | undefined): DiffBlock[] {
  if (!content?.content) return [];

  const out: DiffBlock[] = [];
  for (const node of content.content) {
    if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
      for (const item of node.content ?? []) {
        out.push({
          id: blockIdForNode(item),
          type: item.type ?? node.type,
          text: walkInline(item.content),
        });
      }
      continue;
    }

    if (node.type === "table") {
      out.push({
        id: blockIdForNode(node),
        type: "table",
        text: "[table]",
      });
      continue;
    }

    out.push({
      id: blockIdForNode(node),
      type: node.type ?? "paragraph",
      text: walkInline(node.content),
    });
  }

  return out;
}

function blocksEqual(left: DiffBlock, right: DiffBlock): boolean {
  if (left.id && right.id) return left.id === right.id;
  return left.type === right.type && left.text === right.text;
}

function blocksLikelyModified(left: DiffBlock, right: DiffBlock): boolean {
  if (left.id && right.id) return left.id === right.id;
  return left.type === right.type;
}

export function diffBlocks(left: DiffBlock[], right: DiffBlock[]): BlockDiffOp[] {
  const n = left.length;
  const m = right.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (blocksEqual(left[i], right[j])) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops: BlockDiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (blocksEqual(left[i], right[j])) {
      ops.push({ op: "equal", left: left[i], right: right[j] });
      i++;
      j++;
      continue;
    }

    if (blocksLikelyModified(left[i], right[j]) && dp[i + 1][j + 1] >= Math.max(dp[i + 1][j], dp[i][j + 1])) {
      ops.push({ op: "modified", left: left[i], right: right[j] });
      i++;
      j++;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "removed", left: left[i] });
      i++;
    } else {
      ops.push({ op: "added", right: right[j] });
      j++;
    }
  }

  while (i < n) ops.push({ op: "removed", left: left[i++] });
  while (j < m) ops.push({ op: "added", right: right[j++] });

  return ops;
}

export function summarizeDiffOps(ops: BlockDiffOp[]) {
  return ops.reduce(
    (acc, op) => {
      acc.total += 1;
      if (op.op === "equal") acc.equal += 1;
      if (op.op === "added") acc.added += 1;
      if (op.op === "removed") acc.removed += 1;
      if (op.op === "modified") acc.modified += 1;
      return acc;
    },
    { total: 0, equal: 0, added: 0, removed: 0, modified: 0 }
  );
}
