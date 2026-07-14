'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updated_at: string;
}

interface AIChatPanelProps {
  documentId: string;
  documentContent: string;
  documentTitle: string;
  selectedText?: string;
}

const QUICK_ACTIONS = [
  { label: 'Make shorter', prompt: 'Make the writing more concise and shorter.' },
  { label: 'Professional', prompt: 'Rewrite in a more professional tone.' },
  { label: 'Fix grammar', prompt: 'Fix any grammar or spelling issues.' },
  { label: 'Simplify', prompt: 'Simplify the language for a wider audience.' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Last updated just now';
  if (diffMin < 60) return `Last updated ${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Last updated ${diffHours}h ago`;

  const isThisYear = date.getFullYear() === now.getFullYear();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(isThisYear ? {} : { year: 'numeric' }),
  };
  return date.toLocaleDateString('en-US', options);
}

export default function AIChatPanel({
  documentId,
  documentContent,
  documentTitle,
  selectedText,
}: AIChatPanelProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
        setMenuOpenId(null);
        setRenamingId(null);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, messages, updated_at')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (data) setSessions(data as ChatSession[]);
  }, [user, documentId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const saveSession = useCallback(
    async (sessionId: string, msgs: Message[]) => {
      if (!user) return;
      const supabase = createSupabaseBrowserClient();
      const title =
        msgs.find((m) => m.role === 'user')?.content.slice(0, 50) || 'New chat';
      await supabase
        .from('chat_sessions')
        .update({
          messages: msgs,
          title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      fetchSessions();
    },
    [user, fetchSessions]
  );

  const createNewSession = async (): Promise<string | null> => {
    if (!user) return null;
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        document_id: documentId,
        user_id: user.id,
        title: 'New chat',
        messages: [],
      })
      .select('id')
      .single();
    if (error || !data) return null;
    await fetchSessions();
    return data.id;
  };

  const handleNewChat = async () => {
    const newId = await createNewSession();
    if (newId) {
      setActiveSessionId(newId);
      setMessages([]);
      setShowHistory(false);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    if (renamingId) return;
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
    setMenuOpenId(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const supabase = createSupabaseBrowserClient();
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
    setMenuOpenId(null);
    await fetchSessions();
  };

  const handleStartRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameValue(session.title);
    setMenuOpenId(null);
  };

  const handleConfirmRename = async () => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('chat_sessions')
      .update({ title: renameValue.trim() })
      .eq('id', renamingId);
    setRenamingId(null);
    await fetchSessions();
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming || !user) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) return;
      setActiveSessionId(sessionId);
    }

    const userMessage: Message = { role: 'user', content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content }) => ({ role, content })),
          documentContent,
          selectedText,
        }),
      });

      if (!res.ok) throw new Error('AI request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
            return updated;
          });
        }
      }

      const finalMessages = [...updatedMessages, { role: 'assistant' as const, content: assistantContent }];
      setMessages(finalMessages);
      await saveSession(sessionId, finalMessages);
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.content !== ''),
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(selectedText ? `${prompt}\n\nFocus on this text: "${selectedText}"` : prompt);
  };

  const activeTitle = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId)?.title ?? 'New chat'
    : 'New AI chat';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none px-4 py-2.5 border-b border-gray-100" ref={historyRef}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setShowHistory(!showHistory); setMenuOpenId(null); setRenamingId(null); }}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors min-w-0"
          >
            <span className="truncate max-w-[180px]">{activeTitle}</span>
            <svg
              className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={handleNewChat}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
        </div>

        {/* History dropdown */}
        {showHistory && (
          <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-72 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No previous chats</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  className={`relative px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 ${
                    session.id === activeSessionId ? 'bg-blue-50/60' : ''
                  }`}
                >
                  {/* Rename inline input */}
                  {renamingId === session.id ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        onBlur={handleConfirmRename}
                        className="w-full text-sm px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${
                          session.id === activeSessionId ? 'font-medium text-blue-700' : 'text-gray-800'
                        }`}>
                          {session.title}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(session.updated_at)}</p>
                      </div>

                      {/* Three-dot menu trigger */}
                      <div className="relative flex-shrink-0" ref={menuOpenId === session.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === session.id ? null : session.id);
                          }}
                          className="p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {/* Context menu */}
                        {menuOpenId === session.id && (
                          <div className="absolute right-0 top-7 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartRename(session);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                              </svg>
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">Strux AI</p>
            <p className="text-xs text-gray-500 max-w-[200px] mx-auto">
              Ask me to improve your writing, fix grammar, change tone, or anything else.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full
                             hover:bg-purple-50 hover:text-purple-700 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-none p-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2 mb-2">
          {selectedText ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-full max-w-full">
              <svg className="w-3 h-3 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="text-[10px] font-medium text-purple-700 truncate">
                Selected: &ldquo;{selectedText.slice(0, 40)}{selectedText.length > 40 ? '...' : ''}&rdquo;
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-[10px] font-medium text-gray-500 truncate">
                {documentTitle || 'Untitled'}
              </span>
            </div>
          )}
        </div>

        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Do anything with AI..."
            rows={2}
            className="w-full px-4 py-3 pr-12 text-sm border border-gray-200 rounded-xl resize-none
                       placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500
                       focus:border-transparent"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="absolute right-2 bottom-2 p-2 bg-gray-900 text-white rounded-lg
                       hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>

        {messages.length > 0 && !streaming && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {QUICK_ACTIONS.slice(0, 3).map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                className="text-[10px] px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-500
                           rounded-full hover:border-purple-200 hover:text-purple-600 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
