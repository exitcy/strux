"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemePreference } from "@/components/theme/ThemeProvider";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", description: "Always use the light theme", icon: Sun },
  { value: "dark", label: "Dark", description: "Always use the dark theme", icon: Moon },
  { value: "system", label: "System", description: "Match your OS preference", icon: Monitor },
];

export default function ThemeToggle({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ActiveIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon-sm" : "sm"}
            className={className}
            aria-label="Toggle theme"
            title="Theme"
          />
        }
      >
        <ActiveIcon className="size-4" />
        {!compact && <span>Theme</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = theme === option.value;

            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme(option.value)}
                className="items-start gap-3 py-2"
              >
                <Icon className="mt-0.5 size-4 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.description}</span>
                </div>
                {selected && <Check className="mt-0.5 size-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
