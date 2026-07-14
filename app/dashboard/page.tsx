'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import DashboardShell from '@/components/dashboard/DashboardShell';
import DocumentsDataTable from '@/components/dashboard/DocumentsDataTable';
import ProjectSections from '@/components/dashboard/ProjectSections';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createDocument,
  deleteDocument,
  fetchDashboardDocuments,
  filterByNav,
  renameDocument,
  toggleDocumentStar,
  type DashboardDocRow,
  type DashboardNav,
} from '@/lib/dashboard-queries';

const EMPTY_COPY: Record<DashboardNav, { title: string; description: string }> = {
  projects: {
    title: 'No projects yet',
    description: 'Create a document to start organizing work by project.',
  },
  recent: {
    title: 'No recent activity',
    description: 'Documents you edit will appear here.',
  },
  starred: {
    title: 'No starred documents',
    description: 'Star documents from the row menu to pin them here.',
  },
  shared: {
    title: 'Nothing shared with you',
    description: 'When someone invites you to a document, it will show up here.',
  },
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<DashboardDocRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeNav, setActiveNav] = useState<DashboardNav>('projects');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const loadDocs = useCallback(async () => {
    if (!user) return;
    setLoadingDocs(true);
    const data = await fetchDashboardDocuments(user.id);
    setRows(data);
    setLoadingDocs(false);
  }, [user]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(
    () => (user ? filterByNav(rows, activeNav, user.id) : []),
    [rows, activeNav, user]
  );

  const handleCreateDoc = async () => {
    if (!user || creating) return;
    setCreating(true);
    const id = await createDocument(user.id);
    setCreating(false);
    if (id) router.push(`/doc/${id}`);
  };

  const handleRename = async (id: string, title: string) => {
    const ok = await renameDocument(id, title);
    if (ok) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteDocument(id);
    if (ok) setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggleStar = async (id: string, starred: boolean) => {
    const ok = await toggleDocumentStar(id, starred);
    if (ok) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, starred } : r)));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="size-8 rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardShell
      activeNav={activeNav}
      onNavChange={setActiveNav}
      onCreateDocument={handleCreateDoc}
      creating={creating}
    >
      {loadingDocs ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-muted">
            <FileText className="size-7 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">{EMPTY_COPY[activeNav].title}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{EMPTY_COPY[activeNav].description}</p>
          {activeNav !== 'shared' && (
            <Button className="mt-6 gap-2" onClick={handleCreateDoc} disabled={creating}>
              <Plus className="size-4" />
              New document
            </Button>
          )}
        </div>
      ) : activeNav === 'projects' ? (
        <ProjectSections
          rows={filtered}
          onRename={handleRename}
          onDelete={handleDelete}
          onToggleStar={handleToggleStar}
        />
      ) : (
        <DocumentsDataTable
          rows={filtered}
          onRename={handleRename}
          onDelete={handleDelete}
          onToggleStar={handleToggleStar}
        />
      )}
    </DashboardShell>
  );
}
