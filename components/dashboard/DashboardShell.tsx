'use client';

import { useRouter } from 'next/navigation';
import {
  Clock,
  FolderKanban,
  LogOut,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import ThemeToggle from '@/components/theme/ThemeToggle';
import type { DashboardNav } from '@/lib/dashboard-queries';
import { colorForUser } from '@/lib/realtime';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';

const NAV_ITEMS: { id: DashboardNav; label: string; icon: typeof FolderKanban }[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'shared', label: 'Shared with me', icon: Users },
  { id: 'trash', label: 'Trash', icon: Trash2 },
];

type DashboardShellProps = {
  children: ReactNode;
  activeNav: DashboardNav;
  onNavChange: (nav: DashboardNav) => void;
  onCreateDocument: () => void;
  creating?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
};

export default function DashboardShell({
  children,
  activeNav,
  onNavChange,
  onCreateDocument,
  creating,
  searchQuery = '',
  onSearchChange,
}: DashboardShellProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <SidebarProvider defaultOpen open onOpenChange={() => {}} className="bg-background">
      <Sidebar collapsible="offcanvas" variant="sidebar" className="select-none border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <span className="text-xs font-bold">S</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold tracking-tight">Strux</span>
              <span className="truncate text-[10px] text-muted-foreground">
                Command center
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="select-none px-1">
          <SidebarGroup>
            <SidebarGroupLabel className="cursor-default select-none px-3 text-[10px] uppercase tracking-wider">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeNav === id}
                      onClick={() => onNavChange(id)}
                      tooltip={label}
                      className="cursor-pointer select-none rounded-lg"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="mx-3" />

          <SidebarGroup className="px-3">
            <Button
              type="button"
              className="w-full cursor-pointer justify-start gap-2 rounded-lg"
              onClick={onCreateDocument}
              disabled={creating}
            >
              <Plus className="size-4" />
              <span>New document</span>
            </Button>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border select-none">
          {user && (
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar size="sm" className="pointer-events-none shrink-0">
                <AvatarFallback
                  className="text-[10px] font-semibold text-white"
                  style={{ backgroundColor: colorForUser(user.id) }}
                >
                  {user.email?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="cursor-default truncate text-xs font-medium">
                  {user.email?.split('@')[0]}
                </p>
                <p className="cursor-default truncate text-[10px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <ThemeToggle compact className="shrink-0" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleSignOut}
                className="shrink-0"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="select-none">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger className="md:hidden" type="button" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
            <h1 className="truncate text-sm font-semibold">
              {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Dashboard'}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle className="hidden sm:inline-flex" />
              {onSearchChange && activeNav !== 'trash' && (
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search documents…"
                    className="h-8 w-44 pl-8 text-xs md:w-56"
                  />
                </div>
              )}
              {activeNav !== 'trash' && (
                <Button
                  type="button"
                  onClick={onCreateDocument}
                  disabled={creating}
                  size="sm"
                  className="gap-1.5"
                >
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">New document</span>
                  <span className="sm:hidden">New</span>
                </Button>
              )}
            </div>
          </div>
        </header>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
