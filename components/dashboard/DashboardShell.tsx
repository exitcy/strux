'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  FolderKanban,
  LogOut,
  Plus,
  Star,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';
import type { DashboardNav } from '@/lib/dashboard-queries';
import { colorForUser } from '@/lib/realtime';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
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

function readSidebarOpenFromCookie(): boolean {
  if (typeof document === 'undefined') return true;
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/);
  return match ? match[1] === 'true' : true;
}

const NAV_ITEMS: { id: DashboardNav; label: string; icon: typeof FolderKanban }[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'shared', label: 'Shared with me', icon: Users },
];

type DashboardShellProps = {
  children: ReactNode;
  activeNav: DashboardNav;
  onNavChange: (nav: DashboardNav) => void;
  onCreateDocument: () => void;
  creating?: boolean;
};

export default function DashboardShell({
  children,
  activeNav,
  onNavChange,
  onCreateDocument,
  creating,
}: DashboardShellProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    setSidebarOpen(readSidebarOpenFromCookie());
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <Sidebar collapsible="icon" variant="inset" className="select-none">
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1">
            <SidebarTrigger className="size-7 shrink-0" />
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-xs font-bold">S</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
              <span className="cursor-default text-sm font-semibold">Strux</span>
              <span className="cursor-default text-[10px] text-muted-foreground">
                Command center
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="select-none">
          <SidebarGroup>
            <SidebarGroupLabel className="cursor-default select-none">Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      type="button"
                      isActive={activeNav === id}
                      onClick={() => onNavChange(id)}
                      tooltip={label}
                      className="cursor-pointer select-none"
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator />

          <SidebarGroup className="px-2">
            <Button
              type="button"
              className="w-full cursor-pointer justify-start gap-2"
              onClick={onCreateDocument}
              disabled={creating}
            >
              <Plus className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">New document</span>
            </Button>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border select-none">
          {user && (
            <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center">
              <Avatar size="sm" className="pointer-events-none">
                <AvatarFallback
                  className="text-[10px] font-semibold text-white"
                  style={{ backgroundColor: colorForUser(user.id) }}
                >
                  {user.email?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="cursor-default truncate text-xs font-medium">
                  {user.email?.split('@')[0]}
                </p>
                <p className="cursor-default truncate text-[10px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleSignOut}
                className="shrink-0 group-data-[collapsible=icon]:hidden"
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" type="button" />
          <div className="flex flex-1 cursor-default items-center justify-between gap-4">
            <div>
              <h1 className="text-sm font-semibold">
                {NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Dashboard'}
              </h1>
              <p className="text-xs text-muted-foreground">
                Git-style versioning for technical writing
              </p>
            </div>
            <Button
              type="button"
              onClick={onCreateDocument}
              disabled={creating}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="size-4" />
              New document
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
