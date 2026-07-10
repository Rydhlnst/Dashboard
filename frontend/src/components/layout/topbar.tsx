"use client";

import { AuthUser } from "@/types/user";
import { Bell } from "lucide-react";

interface TopbarProps {
  user: AuthUser;
  title?: string;
}

export function Topbar({ user, title }: TopbarProps) {
  return (
    <header className="relative flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:px-6">
      <h1 className="text-base font-semibold tracking-tight text-foreground">
        {title || "Dashboard"}
      </h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold leading-none">{user.name}</p>
            <p className="mt-0.5 text-[10px] capitalize leading-none text-muted-foreground">
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
