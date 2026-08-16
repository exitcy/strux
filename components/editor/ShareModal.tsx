'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Copy, Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface Collaborator {
  id: string;
  email: string;
  role: 'editor' | 'viewer';
  user_id: string | null;
}

interface ShareModalProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

export default function ShareModal({ documentId, open, onClose }: ShareModalProps) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const docUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/doc/${documentId}` : `/doc/${documentId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(docUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const fetchCollaborators = useCallback(async () => {
    setLoadingList(true);
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from('document_collaborators')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (data) setCollaborators(data);
    setLoadingList(false);
  }, [documentId]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, documentId, fetchCollaborators]);

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>Invite people to collaborate on this document.</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Document link
            </p>
            <div className="flex gap-2">
              <Input readOnly value={docUrl} className="text-xs" />
              <Button type="button" variant="outline" size="sm" onClick={copyLink} className="shrink-0 gap-1.5">
                {linkCopied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                {linkCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Viewers can read and comment. Editors can edit. Invite by email below.
            </p>
          </div>

          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              placeholder="Enter email address"
              className="flex-1"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button onClick={handleInvite} disabled={!email.trim() || loading} size="default">
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Invite'}
            </Button>
          </div>

          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {success && <p className="mt-2 text-xs text-green-600">{success}</p>}
        </div>

        <div className="border-t px-6 py-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            People with access
          </h3>
          {loadingList ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="max-h-60 space-y-1 overflow-y-auto">
              <div className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {ownerEmail?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {ownerEmail?.split('@')[0]}{' '}
                      {ownerEmail === user?.email && (
                        <span className="text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{ownerEmail}</p>
                  </div>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Owner
                </span>
              </div>

              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="group flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                      collab.user_id ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {collab.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{collab.email.split('@')[0]}</p>
                      <p className="text-xs text-muted-foreground">
                        {collab.email}
                        {!collab.user_id && <span className="ml-1 text-amber-600">(pending)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={collab.role}
                      onChange={(e) => handleRoleChange(collab.id, e.target.value as 'editor' | 'viewer')}
                      className="rounded-lg border border-input bg-background px-2 py-1 text-xs"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemove(collab.id)}
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                      title="Remove access"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}

              {collaborators.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No collaborators yet. Invite someone above.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
