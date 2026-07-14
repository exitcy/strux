import { Extension } from '@tiptap/core';
import type { DecorationAttrs } from '@tiptap/pm/view';
import type { Awareness } from 'y-protocols/awareness';
import { defaultSelectionBuilder } from '@tiptap/y-tiptap';

import { yCursorPluginPersistOnBlur } from '@/lib/y-cursor-plugin-persist-on-blur';

type CollaborationCaretStorage = {
  users: { clientId: number; [key: string]: unknown }[];
};

export interface PersistingCollaborationCaretOptions {
  provider: { awareness: Awareness } | null;
  user: Record<string, unknown>;
  render: (user: Record<string, unknown>) => HTMLElement;
  selectionRender: (user: Record<string, unknown>) => DecorationAttrs;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    collaborationCaret: {
      updateUser: (attributes: Record<string, unknown>) => ReturnType;
    };
  }
}

const awarenessStatesToArray = (states: Map<number, Record<string, unknown>>) =>
  Array.from(states.entries()).map(([clientId, value]) => ({
    clientId,
    ...(value.user as Record<string, unknown>),
  }));

/**
 * Same as `@tiptap/extension-collaboration-caret` but wires
 * {@link yCursorPluginPersistOnBlur} so remote carets stay visible after the
 * local editor blurs (idle / AFK), using the last Yjs relative selection.
 */
export const PersistingCollaborationCaret = Extension.create<
  PersistingCollaborationCaretOptions,
  CollaborationCaretStorage
>({
  name: 'collaborationCaret',
  priority: 999,

  addOptions() {
    return {
      provider: null as PersistingCollaborationCaretOptions['provider'] | null,
      user: { name: null, color: null } as Record<string, unknown>,
      render: (user: Record<string, unknown>) => {
        const cursor = document.createElement('span');
        cursor.className = 'collab-caret';
        cursor.style.color = String(user.color ?? '#888');
        const label = document.createElement('span');
        label.className = 'collab-caret-label';
        label.style.backgroundColor = String(user.color ?? '#888');
        label.textContent = String(user.name ?? '');
        cursor.appendChild(label);
        return cursor;
      },
      selectionRender: defaultSelectionBuilder as (user: Record<string, unknown>) => DecorationAttrs,
    };
  },

  onCreate() {
    if (!this.options.provider) {
      throw new Error('The "provider" option is required for PersistingCollaborationCaret');
    }
  },

  addStorage() {
    return { users: [] as CollaborationCaretStorage['users'] };
  },

  addCommands() {
    return {
      updateUser:
        (attributes: Record<string, unknown>) =>
        () => {
          this.options.provider!.awareness.setLocalStateField('user', attributes);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      yCursorPluginPersistOnBlur(
        (() => {
          this.options.provider!.awareness.setLocalStateField('user', this.options.user);
          this.storage.users = awarenessStatesToArray(this.options.provider!.awareness.states);
          this.options.provider!.awareness.on('update', () => {
            this.storage.users = awarenessStatesToArray(this.options.provider!.awareness.states);
          });
          return this.options.provider!.awareness;
        })(),
        {
          cursorBuilder: (user, _clientId) => this.options.render(user),
          selectionBuilder: (user, _clientId) => this.options.selectionRender(user),
        },
      ),
    ];
  },
});
