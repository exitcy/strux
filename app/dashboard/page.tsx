'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, FileText, Plus, RefreshCw } from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import DashboardShell from '@/components/dashboard/DashboardShell';
import DocumentsDataTable from '@/components/dashboard/DocumentsDataTable';
import ProjectSections from '@/components/dashboard/ProjectSections';
import CreateDocumentDialog from '@/components/dashboard/CreateDocumentDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DocumentTemplateId } from '@/lib/templates';
import {
  createDocument,
  deleteDocument,
  fetchDashboardDocuments,
  fetchTrashedDocuments,
  filterByNav,
  filterBySearch,
  permanentlyDeleteDocument,
  renameDocument,
  restoreDocument,
  toggleDocumentStar,
  updateDocumentProject,
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
  trash: {
    title: 'Trash is empty',
    description: 'Deleted documents appear here for 30 days before permanent removal.',
  },
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<DashboardDocRow[]>([]);
  const [trashRows, setTrashRows] = useState<DashboardDocRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeNav, setActiveNav] = useState<DashboardNav>('projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!actionError) return;
    const t = window.setTimeout(() => setActionError(''), 5000);
    return () => window.clearTimeout(t);
  }, [actionError]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const loadDocs = useCallback(async () => {
    if (!user) return;
    setLoadingDocs(true);
    setFetchError('');
    const [{ rows: data, error }, trash] = await Promise.all([
      fetchDashboardDocuments(user.id),
      fetchTrashedDocuments(user.id),
    ]);
    setRows(data);
    setTrashRows(trash);
    if (error) setFetchError(error);
    setLoadingDocs(false);
  }, [user]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const filtered = useMemo(() => {
    if (!user) return [];
    const base = activeNav === 'trash' ? trashRows : filterByNav(rows, activeNav, user.id);
    return filterBySearch(base, searchQuery);
  }, [rows, trashRows, activeNav, user, searchQuery]);

  const handleCreateDoc = async (projectName: string, templateId: DocumentTemplateId) => {
    if (!user || creating) return;
    setCreateDialogOpen(false);
    setCreating(true);
    setCreateError('');
    const id = await createDocument(user.id, projectName, templateId);
    setCreating(false);
    if (id) {
      router.push(`/doc/${id}`);
    } else {
      setCreateError('Failed to create document. Please try again.');
    }
  };

  const handleRename = async (id: string, title: string) => {
    const prevRows = rows;
    const prevTrash = trashRows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
    setTrashRows((prev) => prev.map((r) => (r.id === id ? { ...r, title } : r)));
    const ok = await renameDocument(id, title);
    if (!ok) {
      setRows(prevRows);
      setTrashRows(prevTrash);
      setActionError('Failed to rename document. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    const removed = rows.find((r) => r.id === id);
    const prevRows = rows;
    const prevTrash = trashRows;
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (removed) setTrashRows((prev) => [{ ...removed }, ...prev]);
    const ok = await deleteDocument(id);
    if (!ok) {
      setRows(prevRows);
      setTrashRows(prevTrash);
      setActionError('Failed to delete document. Please try again.');
    }
  };

  const handleRestore = async (id: string) => {
    const restored = trashRows.find((r) => r.id === id);
    const prevRows = rows;
    const prevTrash = trashRows;
    setTrashRows((prev) => prev.filter((r) => r.id !== id));
    if (restored) setRows((prev) => [{ ...restored }, ...prev]);
    const ok = await restoreDocument(id);
    if (!ok) {
      setRows(prevRows);
      setTrashRows(prevTrash);
      setActionError('Failed to restore document. Please try again.');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    const prevTrash = trashRows;
    setTrashRows((prev) => prev.filter((r) => r.id !== id));
    const ok = await permanentlyDeleteDocument(id);
    if (!ok) {
      setTrashRows(prevTrash);
      setActionError('Failed to permanently delete document. Please try again.');
    }
  };

  const handleToggleStar = async (id: string, starred: boolean) => {
    const prevRows = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, starred } : r)));
    const ok = await toggleDocumentStar(id, starred);
    if (!ok) {
      setRows(prevRows);
      setActionError('Failed to update star. Please try again.');
    }
  };

  const handleMoveProject = async (id: string, projectName: string) => {
    const prevRows = rows;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, project_name: projectName } : r)));
    const ok = await updateDocumentProject(id, projectName);
    if (!ok) {
      setRows(prevRows);
      setActionError('Failed to move document. Please try again.');
    }
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
    <>
      <DashboardShell
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onCreateDocument={() => setCreateDialogOpen(true)}
        creating={creating}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        {fetchError ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 py-16 text-center">
            <AlertCircle className="mb-3 size-8 text-destructive" />
            <h2 className="text-lg font-semibold">Could not load documents</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{fetchError}</p>
            <Button className="mt-6 gap-2" onClick={loadDocs}>
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        ) : loadingDocs ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-muted">
              <FileText className="size-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">
              {searchQuery ? 'No matching documents' : EMPTY_COPY[activeNav].title}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {searchQuery
                ? 'Try a different search term or clear the search box.'
                : EMPTY_COPY[activeNav].description}
            </p>
            {activeNav !== 'shared' && activeNav !== 'trash' && !searchQuery && (
              <Button className="mt-6 gap-2" onClick={() => setCreateDialogOpen(true)} disabled={creating}>
                <Plus className="size-4" />
                New document
              </Button>
            )}
          </div>
        ) : activeNav === 'trash' ? (
          <DocumentsDataTable
            rows={filtered}
            mode="trash"
            onRestore={handleRestore}
            onPermanentDelete={handlePermanentDelete}
          />
        ) : activeNav === 'projects' ? (
          <ProjectSections
            rows={filtered}
            onRename={handleRename}
            onDelete={handleDelete}
            onToggleStar={handleToggleStar}
            onMoveProject={handleMoveProject}
          />
        ) : (
          <DocumentsDataTable
            rows={filtered}
            onRename={handleRename}
            onDelete={handleDelete}
            onToggleStar={handleToggleStar}
            onMoveProject={handleMoveProject}
          />
        )}
      </DashboardShell>

      <CreateDocumentDialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); setCreateError(''); }}
        onCreate={handleCreateDoc}
        creating={creating}
      />

      {createError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg">
          {createError}
        </div>
      )}

      {actionError && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-lg">
          {actionError}
        </div>
      )}
    </>
  );
}
