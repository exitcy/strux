'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent);
const mod = isMac ? '⌘' : 'Ctrl';

const SECTIONS = [
  {
    title: 'Text Formatting',
    shortcuts: [
      { keys: `${mod} + B`, action: 'Bold' },
      { keys: `${mod} + I`, action: 'Italic' },
      { keys: `${mod} + U`, action: 'Underline' },
      { keys: `${mod} + Shift + X`, action: 'Strikethrough' },
      { keys: `${mod} + E`, action: 'Inline code' },
    ],
  },
  {
    title: 'Blocks',
    shortcuts: [
      { keys: '/ + type', action: 'Slash command menu' },
      { keys: '# + Space', action: 'Heading 1' },
      { keys: '## + Space', action: 'Heading 2' },
      { keys: '### + Space', action: 'Heading 3' },
      { keys: '- + Space', action: 'Bullet list' },
      { keys: '1. + Space', action: 'Numbered list' },
      { keys: '> + Space', action: 'Blockquote' },
      { keys: '``` + Space', action: 'Code block' },
      { keys: '--- ', action: 'Horizontal rule' },
      { keys: '[] + Space', action: 'Checklist item' },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { keys: `${mod} + F`, action: 'Find & Replace' },
      { keys: `${mod} + Z`, action: 'Undo' },
      { keys: `${mod} + Shift + Z`, action: 'Redo' },
      { keys: `${mod} + A`, action: 'Select all' },
      { keys: 'Enter', action: 'New paragraph' },
      { keys: 'Shift + Enter', action: 'Line break' },
      { keys: `${mod} + Shift + /`, action: 'This shortcut sheet' },
    ],
  },
];

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Speed up your workflow</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 pb-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.shortcuts.map((s) => (
                  <div
                    key={s.action}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/50"
                  >
                    <span className="text-sm">{s.action}</span>
                    <kbd className="rounded-md border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t px-6 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
