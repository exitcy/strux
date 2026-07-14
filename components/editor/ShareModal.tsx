'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';

interface Collaborator {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  user_id: string | null;
}

interface ShareModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ documentId, isOpen, onClose }: ShareModalProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const fetchCollaborators = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from('document_collaborators')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (data) setCollaborators(data);
  }, [documentId]);

  useEffect(() => {
    if (!isOpen) return;
    fetchCollaborators();

    const loadOwner = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase
        .from('documents')
        .select('owner_id')
        .eq('id', documentId)
        .single();

      if (data?.owner_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', data.owner_id)
          .single();
        if (profile) setOwnerEmail(profile.email);
      }
    };
    loadOwner();
  }, [isOpen, documentId, fetchCollaborators]);

  const handleInvite = async () => {
    if (!email.trim() || !user) return;

    const trimmed = email.trim().toLowerCase();
    if (trimmed === user.email?.toLowerCase()) {
      setError("You can't invite yourself");
      return;
    }

    if (collaborators.some((c) => c.email.toLowerCase() === trimmed)) {
      setError('This person already has access');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const supabase = createSupabaseBrowserClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', trimmed)
      .single();

    const { error: insertError } = await supabase
      .from('document_collaborators')
      .insert({
        document_id: documentId,
        user_id: profile?.id ?? null,
        email: trimmed,
        role,
      });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(`Invited ${trimmed} as ${role}`);
      setEmail('');
      await fetchCollaborators();
      setTimeout(() => setSuccess(''), 3000);
    }

    setLoading(false);
  };

  const handleRoleChange = async (collabId: string, newRole: 'editor' | 'viewer') => {
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('document_collaborators')
      .update({ role: newRole })
      .eq('id', collabId);
    await fetchCollaborators();
  };

  const handleRemove = async (collabId: string) => {
    const supabase = createSupabaseBrowserClient();
    await supabase.from('document_collaborators').delete().eq('id', collabId);
    await fetchCollaborators();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-gray-900">Share document</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500">Invite people to collaborate on this document.</p>
        </div>

        {/* Invite form */}
        <div className="px-6 pb-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="Enter email address"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                         placeholder:text-gray-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="px-2 py-2.5 text-sm border border-gray-200 rounded-xl bg-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={!email.trim() || loading}
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl
                         hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors shadow-sm"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Invite'
              )}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error}
            </p>
          )}
          {success && (
            <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {success}
            </p>
          )}
        </div>

        {/* People with access */}
        <div className="px-6 pb-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            People with access
          </h3>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {/* Owner */}
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                  {ownerEmail?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {ownerEmail?.split('@')[0]}{' '}
                    {ownerEmail === user?.email && (
                      <span className="text-xs text-gray-400">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{ownerEmail}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                Owner
              </span>
            </div>

            {/* Collaborators */}
            {collaborators.map((collab) => (
              <div
                key={collab.id}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    collab.user_id
                      ? 'bg-green-100 text-green-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}>
                    {collab.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {collab.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-400">
                      {collab.email}
                      {!collab.user_id && (
                        <span className="ml-1 text-amber-500">(pending signup)</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={collab.role}
                    onChange={(e) => handleRoleChange(collab.id, e.target.value as 'editor' | 'viewer')}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white
                               focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => handleRemove(collab.id)}
                    className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50
                               opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove access"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {collaborators.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                No collaborators yet. Invite someone above.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
