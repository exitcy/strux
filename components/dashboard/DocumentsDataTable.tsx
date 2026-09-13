'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { GitBranch, MoreHorizontal, Pencil, FolderInput, Star, Trash2, RotateCcw } from 'lucide-react';
import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';

import type { DashboardDocRow, DocStatus } from '@/lib/dashboard-queries';
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const READONLY_BADGE =
  'pointer-events-none cursor-default select-none tabular-nums';

function formatActivity(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReadOnlyStatusBadge({ status }: { status: DocStatus }) {
  const map: Record<DocStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    main: { label: 'Main', variant: 'default' },
    branch: { label: 'Branch', variant: 'secondary' },
    draft: { label: 'Draft', variant: 'outline' },
  };
  const { label, variant } = map[status];
  return (
    <Badge variant={variant} className={READONLY_BADGE} aria-label={`Status: ${label}`}>
      {label}
    </Badge>
  );
}

function ActiveBranchesCell({ count }: { count: number }) {
  if (count === 0) {
    return <span className="inline-block min-w-[1ch] select-none" aria-hidden />;
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        READONLY_BADGE,
        'gap-1 border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      )}
      aria-label={`${count} active branch${count === 1 ? '' : 'es'}`}
    >
      <GitBranch className="size-3 shrink-0" aria-hidden />
      {count}
    </Badge>
  );
}

type DocumentsDataTableProps = {
  rows: DashboardDocRow[];
  mode?: 'normal' | 'trash';
  canManage?: (row: DashboardDocRow) => boolean;
  onRename?: (id: string, title: string) => void;
  onDelete?: (id: string) => void;
  onToggleStar?: (id: string, starred: boolean) => void;
  onMoveProject?: (id: string, projectName: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
};

export default function DocumentsDataTable({
  rows,
  mode = 'normal',
  canManage = (r) => r.source === 'owned',
  onRename,
  onDelete,
  onToggleStar,
  onMoveProject,
  onRestore,
  onPermanentDelete,
}: DocumentsDataTableProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveValue, setMoveValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const deleteRow = rows.find((r) => r.id === deleteId);

  const openDocument = useCallback(
    (id: string) => {
      router.push(`/doc/${id}`);
    },
    [router]
  );

  const prefetchDocument = useCallback(
    (id: string) => {
      router.prefetch(`/doc/${id}`);
    },
    [router]
  );

  const columns = useMemo<ColumnDef<DashboardDocRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Name',
        cell: ({ row }) => {
          const doc = row.original;
          const hasBranches = doc.branch_count > 0;
          return (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Link
                href={`/doc/${doc.id}`}
                prefetch
                onClick={(e) => e.stopPropagation()}
                className="truncate font-medium text-foreground hover:underline"
              >
                {doc.title}
              </Link>
              {hasBranches && (
                <Badge
                  variant="outline"
                  className={cn(
                    READONLY_BADGE,
                    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  )}
                >
                  In progress
                </Badge>
              )}
              {doc.source === 'shared' && doc.owner_email && (
                <span className="truncate text-xs text-muted-foreground">
                  · {doc.owner_email.split('@')[0]}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'doc_status',
        header: 'Status',
        cell: ({ row }) => <ReadOnlyStatusBadge status={row.original.doc_status} />,
      },
      {
        id: 'branches',
        header: 'Active branches',
        cell: ({ row }) => <ActiveBranchesCell count={row.original.branch_count} />,
      },
      {
        accessorKey: 'last_activity_at',
        header: 'Last activity',
        cell: ({ row }) => (
          <span className="select-none text-muted-foreground">
            {formatActivity(row.original.last_activity_at)}
          </span>
        ),
      },
      {
        id: 'collaborators',
        header: 'Collaborators',
        cell: ({ row }) => {
          const people = row.original.collaborators;
          if (people.length === 0) {
            return <span className="select-none text-muted-foreground/40" aria-hidden />;
          }
          return (
            <AvatarGroup className="pointer-events-none select-none">
              {people.slice(0, 3).map((p) => (
                <Avatar key={p.id} size="sm" title={p.email ?? p.name}>
                  <AvatarFallback
                    className="text-[10px] font-semibold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {people.length > 3 && (
                <AvatarGroupCount>+{people.length - 3}</AvatarGroupCount>
              )}
            </AvatarGroup>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const doc = row.original;
          if (!canManage(doc) && mode !== 'trash') return null;
          if (mode === 'trash') {
            return (
              <DropdownMenu>
                <DropdownMenuTrigger
                  type="button"
                  className="inline-flex size-7 cursor-default select-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                  onClick={(e: MouseEvent) => e.stopPropagation()}
                  onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Trash actions</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => onRestore?.(doc.id)}>
                    <RotateCcw className="size-4" />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setPermanentDeleteId(doc.id)}>
                    <Trash2 className="size-4" />
                    Delete permanently
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="inline-flex size-7 cursor-default select-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                onClick={(e: MouseEvent) => e.stopPropagation()}
                onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Document actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {onToggleStar && (
                  <DropdownMenuItem onClick={() => onToggleStar(doc.id, !doc.starred)}>
                    <Star className={cn('size-4', doc.starred && 'fill-amber-400 text-amber-500')} />
                    {doc.starred ? 'Unstar' : 'Star'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    setRenameId(doc.id);
                    setRenameValue(doc.title);
                  }}
                >
                  <Pencil className="size-4" />
                  Rename
                </DropdownMenuItem>
                {onMoveProject && (
                  <DropdownMenuItem
                    onClick={() => {
                      setMoveId(doc.id);
                      setMoveValue(doc.project_name);
                    }}
                  >
                    <FolderInput className="size-4" />
                    Move to project
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(doc.id)}>
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canManage, mode, onToggleStar, onRestore, onMoveProject]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) return null;

  return (
    <>
      <div className="w-full min-w-0 select-none overflow-hidden rounded-lg border bg-card">
        <Table className="min-w-[640px] table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    scope="col"
                    className={cn(
                      'cursor-default select-none px-3',
                      header.column.id === 'title' && 'w-[36%]',
                      header.column.id === 'doc_status' && 'w-[12%]',
                      header.column.id === 'branches' && 'hidden w-[14%] sm:table-cell',
                      header.column.id === 'last_activity_at' && 'w-[16%]',
                      header.column.id === 'collaborators' && 'hidden w-[16%] md:table-cell',
                      header.column.id === 'actions' && 'w-12'
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const doc = row.original;
              const hasBranches = doc.branch_count > 0;
              return (
                <TableRow
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${doc.title}`}
                  onClick={() => openDocument(doc.id)}
                  onPointerEnter={() => prefetchDocument(doc.id)}
                  onFocus={() => prefetchDocument(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDocument(doc.id);
                    }
                  }}
                  className={cn(
                    'cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    hasBranches && 'border-l-2 border-l-amber-500/70 bg-amber-500/[0.04]'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'px-3',
                        cell.column.id === 'title' && 'max-w-0',
                        cell.column.id === 'branches' && 'hidden sm:table-cell',
                        cell.column.id === 'collaborators' && 'hidden md:table-cell',
                        cell.column.id === 'actions' && 'w-12 cursor-default'
                      )}
                      onClick={
                        cell.column.id === 'actions'
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={renameId !== null} onOpenChange={(open) => !open && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>Update the document title shown in your workspace.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameId && renameValue.trim()) {
                onRename?.(renameId, renameValue.trim());
                setRenameId(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renameId && renameValue.trim()) {
                  onRename?.(renameId, renameValue.trim());
                  setRenameId(null);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Move &ldquo;{deleteRow?.title}&rdquo; to trash? You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId) {
                  onDelete?.(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveId !== null} onOpenChange={(open) => !open && setMoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to project</DialogTitle>
            <DialogDescription>Assign this document to a project folder.</DialogDescription>
          </DialogHeader>
          <Input
            value={moveValue}
            onChange={(e) => setMoveValue(e.target.value)}
            placeholder="General"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && moveId && moveValue.trim()) {
                onMoveProject?.(moveId, moveValue.trim());
                setMoveId(null);
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (moveId && moveValue.trim()) {
                  onMoveProject?.(moveId, moveValue.trim());
                  setMoveId(null);
                }
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permanentDeleteId !== null} onOpenChange={(open) => !open && setPermanentDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete permanently</DialogTitle>
            <DialogDescription>
              Permanently delete this document? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermanentDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (permanentDeleteId) {
                  onPermanentDelete?.(permanentDeleteId);
                  setPermanentDeleteId(null);
                }
              }}
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

