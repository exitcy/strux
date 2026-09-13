'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { Bot, Clock, History, MessageSquare } from 'lucide-react';
import CommentsPanel from './sidebar/CommentsPanel';
import AIChatPanel from './sidebar/AIChatPanel';
import VersionsPanel from './sidebar/VersionsPanel';
import HistoryPanel from './sidebar/HistoryPanel';
import { Button } from '@/components/ui/button';

type Tab = 'comments' | 'ai' | 'versions' | 'history';

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
  currentJSON: JSONContent;
  canEdit: boolean;
  onRestoreVersion: (content: JSONContent, title: string) => void;
  versionsRefreshToken: number;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'comments', label: 'Comments', icon: <MessageSquare className="size-4" /> },
  { id: 'ai', label: 'AI Chat', icon: <Bot className="size-4" /> },
  { id: 'versions', label: 'Versions', icon: <Clock className="size-4" /> },
  { id: 'history', label: 'History', icon: <History className="size-4" /> },
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
    <div className="flex h-full w-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex-none border-b border-zinc-200 px-4 pt-4 pb-3 dark:border-zinc-800">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Review</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
            ×
          </Button>
        </div>

        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'border border-zinc-200 bg-white text-zinc-900 shadow-sm dark:border-transparent dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        {activeTab === 'ai' && canEdit && (
          <AIChatPanel
            documentId={documentId}
            documentContent={documentContent}
            documentTitle={documentTitle}
            selectedText={selectedText}
          />
        )}
        {activeTab === 'ai' && !canEdit && (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            AI chat is available to editors only.
          </div>
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
        {activeTab === 'history' && <HistoryPanel documentId={documentId} />}
      </div>
    </div>
  );
}
