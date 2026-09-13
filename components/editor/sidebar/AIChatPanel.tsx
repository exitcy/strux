'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, MoreHorizontal, Pencil, PenLine, Trash2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

const AI_REQUEST_TIMEOUT_MS = 30_000;

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    if (data && isMountedRef.current) setSessions(data as ChatSession[]);
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
      setRetryMessage(null);
      setHistoryOpen(false);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    if (renamingId) return;
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setRetryMessage(null);
    setHistoryOpen(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const supabase = createSupabaseBrowserClient();
    await supabase.from('chat_sessions').delete().eq('id', sessionId);
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
      setRetryMessage(null);
    }
    await fetchSessions();
  };

  const handleStartRename = (session: ChatSession) => {
    setRenamingId(session.id);
    setRenameValue(session.title);
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

  const sendMessage = async (content: string, options?: { skipUserAppend?: boolean }) => {
    if (!content.trim() || streaming || !user) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createNewSession();
      if (!sessionId) return;
      setActiveSessionId(sessionId);
    }

    const trimmed = content.trim();
    const userMessage: Message = { role: 'user', content: trimmed };
    const updatedMessages = options?.skipUserAppend ? messages : [...messages, userMessage];

    if (!options?.skipUserAppend) {
      setMessages(updatedMessages);
      setInput('');
    }
    setRetryMessage(null);
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(({ role, content: msgContent }) => ({
            role,
            content: msgContent,
          })),
          documentContent,
          selectedText,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error('AI request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      if (isMountedRef.current) {
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      }

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          if (isMountedRef.current) {
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
              return updated;
            });
          }
        }
      }

      const finalMessages = [
        ...updatedMessages,
        { role: 'assistant' as const, content: assistantContent },
      ];
      if (isMountedRef.current) {
        setMessages(finalMessages);
        await saveSession(sessionId, finalMessages);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      setRetryMessage(trimmed);
      setMessages((prev) => [
        ...prev.filter((m) => m.content !== ''),
        {
          role: 'assistant',
          content: isTimeout
            ? 'Request timed out. Tap retry to try again.'
            : 'Sorry, something went wrong. Tap retry to try again.',
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      if (isMountedRef.current) setStreaming(false);
    }
  };

  const handleQuickAction = (prompt: string) => {
    sendMessage(selectedText ? `${prompt}\n\nFocus on this text: "${selectedText}"` : prompt);
  };

  const activeTitle = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId)?.title ?? 'New chat'
    : 'New AI chat';

  return (
    <div className="flex h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="flex-none border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <DropdownMenu open={historyOpen} onOpenChange={setHistoryOpen}>
            <DropdownMenuTrigger
              type="button"
              className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-zinc-900 transition-colors hover:text-zinc-700 dark:text-zinc-100 dark:hover:text-zinc-300"
            >
              <span className="max-w-[180px] truncate">{activeTitle}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 flex-shrink-0 text-zinc-500 transition-transform dark:text-zinc-400 ${
                  historyOpen ? 'rotate-180' : ''
                }`}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-72 overflow-y-auto p-0">
              {sessions.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">No previous chats</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`relative border-b border-zinc-200 last:border-b-0 dark:border-zinc-800 ${
                      session.id === activeSessionId ? 'bg-primary/5' : ''
                    }`}
                  >
                    {renamingId === session.id ? (
                      <div className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleConfirmRename();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onBlur={() => void handleConfirmRename()}
                          className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleSelectSession(session)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={`truncate text-sm ${
                              session.id === activeSessionId
                                ? 'font-medium text-primary'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {session.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                            {formatDate(session.updated_at)}
                          </p>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            type="button"
                            className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleStartRename(session)}>
                              <Pencil className="h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => void handleDeleteSession(session.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => void handleNewChat()}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            title="New chat"
          >
            <PenLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L14.4 7.2L20 9L14.4 10.8L12 16L9.6 10.8L4 9L9.6 7.2L12 2Z" />
              </svg>
            </div>
            <p className="mb-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">Strux AI</p>
            <p className="mx-auto max-w-[200px] text-xs text-zinc-600 dark:text-zinc-400">
              Ask me to improve your writing, fix grammar, change tone, or anything else.
            </p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => handleQuickAction(action.prompt)}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
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
                    ? 'rounded-br-md bg-primary text-primary-foreground'
                    : 'rounded-bl-md border border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                }`}
              >
                {msg.content || (
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </div>
          ))
        )}

        {retryMessage && !streaming && (
          <div className="flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setMessages((prev) => prev.filter((m) => !m.content.includes('try again')));
                void sendMessage(retryMessage, { skipUserAppend: true });
              }}
            >
              Retry last message
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex-none border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-2 flex items-center gap-2">
          {selectedText ? (
            <div className="flex max-w-full items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 dark:border-purple-800/40 dark:bg-purple-950/30">
              <svg className="h-3 w-3 flex-shrink-0 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <span className="truncate text-[10px] font-medium text-purple-700 dark:text-purple-200">
                Selected: &ldquo;{selectedText.slice(0, 40)}{selectedText.length > 40 ? '...' : ''}&rdquo;
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 dark:border-zinc-700 dark:bg-zinc-800">
              <svg className="h-3 w-3 text-zinc-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
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
                void sendMessage(input);
              }
            }}
            placeholder="Do anything with AI..."
            rows={2}
            className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-3 pr-12 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 placeholder:dark:text-zinc-500"
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="absolute bottom-2 right-2 rounded-lg bg-primary p-2 text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>

        {messages.length > 0 && !streaming && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.slice(0, 3).map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] text-zinc-800 shadow-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
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
