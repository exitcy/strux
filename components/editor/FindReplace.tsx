'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/core';

interface FindReplaceProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Match {
  from: number;
  to: number;
}

export default function FindReplace({ editor, isOpen, onClose }: FindReplaceProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);

  const findMatches = useCallback(
    (query: string): Match[] => {
      if (!editor || !query) return [];
      const results: Match[] = [];
      const doc = editor.state.doc;
      const lowerQuery = query.toLowerCase();

      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const lowerText = node.text.toLowerCase();
          let idx = lowerText.indexOf(lowerQuery);
          while (idx !== -1) {
            results.push({ from: pos + idx, to: pos + idx + query.length });
            idx = lowerText.indexOf(lowerQuery, idx + 1);
          }
        }
      });
      return results;
    },
    [editor]
  );

  useEffect(() => {
    if (!isOpen) {
      setFindText('');
      setReplaceText('');
      setMatches([]);
      setCurrentIndex(0);
      return;
    }
    setTimeout(() => findRef.current?.focus(), 100);
  }, [isOpen]);

  useEffect(() => {
    const results = findMatches(findText);
    setMatches(results);
    setCurrentIndex(0);

    if (results.length > 0 && editor) {
      editor.commands.setTextSelection(results[0]);
      scrollToSelection();
    }
  }, [findText, findMatches, editor]);

  const scrollToSelection = () => {
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.top < 100 || rect.bottom > window.innerHeight - 100) {
        window.scrollBy({ top: rect.top - window.innerHeight / 3, behavior: 'smooth' });
      }
    }
  };

  const goToMatch = (index: number) => {
    if (!editor || matches.length === 0) return;
    const wrapped = ((index % matches.length) + matches.length) % matches.length;
    setCurrentIndex(wrapped);
    editor.commands.setTextSelection(matches[wrapped]);
    scrollToSelection();
  };

  const handleReplace = () => {
    if (!editor || matches.length === 0) return;
    const match = matches[currentIndex];
    editor
      .chain()
      .focus()
      .setTextSelection(match)
      .deleteSelection()
      .insertContent(replaceText)
      .run();

    const newMatches = findMatches(findText);
    setMatches(newMatches);
    const nextIdx = currentIndex >= newMatches.length ? 0 : currentIndex;
    setCurrentIndex(nextIdx);
    if (newMatches.length > 0) {
      editor.commands.setTextSelection(newMatches[nextIdx]);
    }
  };

  const handleReplaceAll = () => {
    if (!editor || matches.length === 0) return;
    const reversed = [...matches].reverse();
    editor.chain().focus();
    for (const match of reversed) {
      editor
        .chain()
        .setTextSelection(match)
        .deleteSelection()
        .insertContent(replaceText)
        .run();
    }
    setMatches([]);
    setCurrentIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      goToMatch(currentIndex + 1);
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      goToMatch(currentIndex - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-16 right-6 z-50 bg-white rounded-xl border border-gray-200 shadow-xl w-80">
      <div className="p-3">
        {/* Find row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={findRef}
              type="text"
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Find..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent pr-16"
            />
            {findText && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">
                {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : 'No results'}
              </span>
            )}
          </div>
          <button
            onClick={() => goToMatch(currentIndex - 1)}
            disabled={matches.length === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors"
            title="Previous (Shift+Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
          <button
            onClick={() => goToMatch(currentIndex + 1)}
            disabled={matches.length === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30 transition-colors"
            title="Next (Enter)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className={`p-1.5 rounded-lg transition-colors ${showReplace ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-400'}`}
            title="Toggle replace"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Replace row */}
        {showReplace && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Replace with..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg
                         hover:bg-blue-100 disabled:opacity-30 transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg
                         hover:bg-blue-100 disabled:opacity-30 transition-colors whitespace-nowrap"
            >
              All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
