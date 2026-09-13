'use client';

import { FolderKanban } from 'lucide-react';

import type { DashboardDocRow } from '@/lib/dashboard-queries';
import { groupByProject } from '@/lib/dashboard-queries';
import DocumentsDataTable from '@/components/dashboard/DocumentsDataTable';

type ProjectSectionsProps = {
  rows: DashboardDocRow[];
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onToggleStar?: (id: string, starred: boolean) => void;
  onMoveProject?: (id: string, projectName: string) => void;
};

export default function ProjectSections({
  rows,
  onRename,
  onDelete,
  onToggleStar,
  onMoveProject,
}: ProjectSectionsProps) {
  const grouped = groupByProject(rows);

  return (
    <div className="w-full min-w-0 select-none space-y-8">
      {[...grouped.entries()].map(([projectName, projectRows]) => (
        <section key={projectName} className="min-w-0">
          <div className="mb-3 flex cursor-default select-none items-center gap-2">
            <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="cursor-default truncate text-sm font-semibold tracking-tight">{projectName}</h2>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {projectRows.length} doc{projectRows.length === 1 ? '' : 's'}
            </span>
            {projectRows.some((r) => r.branch_count > 0) && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                Active branches
              </span>
            )}
          </div>
          <DocumentsDataTable
            rows={projectRows}
            onRename={onRename}
            onDelete={onDelete}
            onToggleStar={onToggleStar}
            onMoveProject={onMoveProject}
          />
        </section>
      ))}
    </div>
  );
}
