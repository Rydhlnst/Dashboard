"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, setStoredUser, clearStoredUser } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { AuthUser } from "@/types/user";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DashboardTourProvider } from "@/components/tour/dashboard-tour";

// Module-level cache: verify session with server at most once every 5 minutes
let meCache: { user: AuthUser; ts: number } | null = null;
const ME_TTL = 5 * 60 * 1000;

function isCacheValid() {
  return meCache !== null && Date.now() - meCache.ts < ME_TTL;
}

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  adminOnly?: boolean;
}

export function AppLayout({ children, title, adminOnly = false }: AppLayoutProps) {
  // Initialize directly from cache/localStorage so there is no spinner flash
  // on navigations where the user is already authenticated.
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    if (isCacheValid() && meCache) return meCache.user;
    return getStoredUser();
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    if (isCacheValid() && meCache) return false;
    return getStoredUser() === null; // only show spinner when there is truly no user
  });
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredUser();

    // Cache valid — no network call needed, just ensure state is current
    if (isCacheValid() && meCache) {
      setUser(meCache.user);
      setLoading(false);
      return;
    }

    if (stored) {
      // Show page immediately with stored data while we verify in background
      setUser(stored);
      setLoading(false);

      authApi.me().then((res: any) => {
        if (res.success && res.data) {
          meCache = { user: res.data as AuthUser, ts: Date.now() };
          setStoredUser(res.data);
          setUser(res.data);
        } else {
          // Explicit rejection from server (e.g. session expired)
          meCache = null;
          clearStoredUser();
          router.replace("/login");
        }
      }).catch(() => {
        // Network error — keep local session, don't log out
      });
    } else {
      // No stored user, must verify with server
      authApi.me().then((res: any) => {
        if (res.success && res.data) {
          meCache = { user: res.data as AuthUser, ts: Date.now() };
          setStoredUser(res.data);
          setUser(res.data);
        } else {
          router.replace("/login");
        }
      }).catch(() => {
        router.replace("/login");
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [router]);

  const isAdmin = (role: string) => role === "admin" || role === "super_admin";

  useEffect(() => {
    if (!loading && user && adminOnly && !isAdmin(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, adminOnly, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-b-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (adminOnly && !isAdmin(user.role)) return null;

  return (
    <DashboardTourProvider>
      <div className="flex h-screen overflow-hidden bg-muted/30">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar user={user} title={title} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </DashboardTourProvider>
  );
}
