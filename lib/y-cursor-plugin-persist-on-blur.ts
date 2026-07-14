/**
 * Same behavior as @tiptap/y-tiptap `yCursorPlugin`, except we do **not** clear
 * the awareness `cursor` field when the editor blurs. Upstream clears it so
 * decorations disappear; for Strux we keep the last relative anchor/head so
 * collaborators still see where someone went idle (AFK, another tab, etc.).
 */
import * as Y from 'yjs';
import { Plugin } from '@tiptap/pm/state';
import type { EditorState, Selection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { Awareness } from 'y-protocols/awareness';
import {
  absolutePositionToRelativePosition,
  createDecorations,
  defaultAwarenessStateFilter,
  defaultCursorBuilder,
  defaultSelectionBuilder,
  setMeta,
  yCursorPluginKey,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';

export type YCursorPluginPersistOptions = {
  awarenessStateFilter?: (currentClientId: number, userClientId: number, state: unknown) => boolean;
  cursorBuilder?: (user: Record<string, unknown>, clientId: number) => HTMLElement;
  selectionBuilder?: (user: Record<string, unknown>, clientId: number) => import('@tiptap/pm/view').DecorationAttrs;
  getSelection?: (state: EditorState) => Selection;
};

export function yCursorPluginPersistOnBlur(
  awareness: Awareness,
  {
    awarenessStateFilter = defaultAwarenessStateFilter,
    cursorBuilder = defaultCursorBuilder,
    selectionBuilder = defaultSelectionBuilder,
    getSelection = (state: EditorState) => state.selection,
  }: YCursorPluginPersistOptions = {},
  cursorStateField = 'cursor',
) {
  return new Plugin({
    key: yCursorPluginKey,
    state: {
      init(_, state) {
        return createDecorations(state, awareness, awarenessStateFilter, cursorBuilder, selectionBuilder);
      },
      apply(tr, prevState, _oldState, newState) {
        const ystate = ySyncPluginKey.getState(newState);
        const yCursorState = tr.getMeta(yCursorPluginKey);
        if (
          (ystate && ystate.isChangeOrigin) ||
          (yCursorState && (yCursorState as { awarenessUpdated?: boolean }).awarenessUpdated)
        ) {
          return createDecorations(newState, awareness, awarenessStateFilter, cursorBuilder, selectionBuilder);
        }
        return prevState.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations: (state) => yCursorPluginKey.getState(state),
    },
    view: (view: EditorView) => {
      const awarenessListener = () => {
        // ProseMirror sets docView when the editor view is mounted (not in public types).
        if ((view as EditorView & { docView?: unknown }).docView) {
          setMeta(view, yCursorPluginKey, { awarenessUpdated: true });
        }
      };

      const updateCursorInfo = () => {
        const ystate = ySyncPluginKey.getState(view.state);

        if (view.hasFocus()) {
          const current = (awareness.getLocalState() ?? {}) as Record<string, unknown>;
          if (ystate == null || ystate.binding == null) return;

          const selection = getSelection(view.state);
          const anchor = absolutePositionToRelativePosition(
            selection.anchor,
            ystate.type,
            ystate.binding.mapping,
          );
          const head = absolutePositionToRelativePosition(
            selection.head,
            ystate.type,
            ystate.binding.mapping,
          );

          const cur = current[cursorStateField] as { anchor: unknown; head: unknown } | null | undefined;
          if (
            cur == null ||
            !Y.compareRelativePositions(Y.createRelativePositionFromJSON(cur.anchor), anchor) ||
            !Y.compareRelativePositions(Y.createRelativePositionFromJSON(cur.head), head)
          ) {
            awareness.setLocalStateField(cursorStateField, { anchor, head });
          }
        }
        // When unfocused we intentionally do not clear `cursor` (unlike
        // upstream yCursorPlugin) so peers still see the last caret.
      };

      awareness.on('change', awarenessListener);
      view.dom.addEventListener('focusin', updateCursorInfo);
      view.dom.addEventListener('focusout', updateCursorInfo);

      return {
        update: updateCursorInfo,
        destroy: () => {
          view.dom.removeEventListener('focusin', updateCursorInfo);
          view.dom.removeEventListener('focusout', updateCursorInfo);
          awareness.off('change', awarenessListener);
          awareness.setLocalStateField(cursorStateField, null);
        },
      };
    },
  });
}
