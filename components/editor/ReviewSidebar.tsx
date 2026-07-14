'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import CommentsPanel from './sidebar/CommentsPanel';
import AIChatPanel from './sidebar/AIChatPanel';
import VersionsPanel from './sidebar/VersionsPanel';

type Tab = 'comments' | 'ai' | 'versions';

interface ReviewSidebarProps {
  onClose: () => void;
  documentId: string;
  documentContent: string;
  documentContentJson?: JSONContent | null;
  documentTitle: string;
  selectedText?: string;
  selectedBlockId?: string | null;
  focusChangeId?: string | null;
  initialTab?: Tab;
  onAcceptChange: (nodeIndex: number, proposedText: string) => void;
  getNodeIndex: (text: string) => number;
  // Versions-tab plumbing
  currentJSON: JSONContent;
  canEdit: boolean;
  onRestoreVersion: (content: JSONContent, title: string) => void;
  versionsRefreshToken: number;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'comments',
    label: 'Comments',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'ai',
    label: 'AI Chat',
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
      </svg>
    ),
  },
  {
    id: 'versions',
    label: 'Versions',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function ReviewSidebar({
  onClose,
  documentId,
  documentContent,
  documentContentJson,
  documentTitle,
  selectedText,
  selectedBlockId = null,
  focusChangeId,
  initialTab = 'comments',
  onAcceptChange,
  getNodeIndex,
  currentJSON,
  canEdit,
  onRestoreVersion,
  versionsRefreshToken,
}: ReviewSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col h-full bg-white w-full">
      <div className="flex-none px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Review</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className={activeTab === tab.id && tab.id === 'ai' ? 'text-purple-600' : ''}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === 'comments' && (
          <CommentsPanel
            documentId={documentId}
            selectedText={selectedText}
            selectedBlockId={selectedBlockId}
            documentContent={documentContent}
            documentContentJson={documentContentJson}
            documentTitle={documentTitle}
            focusChangeId={focusChangeId}
            onAcceptChange={onAcceptChange}
            getNodeIndex={getNodeIndex}
          />
        )}
        {activeTab === 'ai' && (
          <AIChatPanel
            documentId={documentId}
            documentContent={documentContent}
            documentTitle={documentTitle}
            selectedText={selectedText}
          />
        )}
        {activeTab === 'versions' && (
          <VersionsPanel
            documentId={documentId}
            currentContent={currentJSON}
            currentTitle={documentTitle}
            canEdit={canEdit}
            onRestore={onRestoreVersion}
            refreshToken={versionsRefreshToken}
          />
        )}
      </div>
    </div>
  );
}
