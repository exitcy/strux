'use client';

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
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 pt-6 pb-3 flex items-center justify-between flex-none">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Keyboard Shortcuts</h2>
            <p className="text-xs text-gray-400 mt-0.5">Speed up your workflow</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 pb-6 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.shortcuts.map((s) => (
                  <div
                    key={s.action}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">{s.action}</span>
                    <kbd className="text-[11px] font-mono text-gray-500 bg-gray-100 border border-gray-200 rounded-md px-2 py-0.5">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
