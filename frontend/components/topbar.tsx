"use client";

import Link from "next/link";
import { Bell, FileText, GitBranch, LogOut, Search } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";
import { axiosInstance } from "@/lib/api";
import type { RepositorySummary } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function Topbar() {
  const { logout, user } = useAuth();
  const { clearNotifications, markAllRead, markRead, notifications, unreadCount } = useNotifications();
  const router = useRouter();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const initials = (user?.name ?? "JD")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const matchingRepositories = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return repositories
      .filter((repository) => repository.name.toLowerCase().includes(normalizedSearchQuery))
      .slice(0, 6);
  }, [normalizedSearchQuery, repositories]);

  useEffect(() => {
    void axiosInstance
      .get<RepositorySummary[]>("/repositories")
      .then((response) => {
        setRepositories(response.data);
        setSearchError(null);
      })
      .catch(() => {
        setRepositories([]);
        setSearchError("Repositories could not be loaded.");
      });
  }, []);

  const openRepository = (repository: RepositorySummary) => {
    setSearchQuery("");
    setIsSearchFocused(false);
    router.push(`/repositories/${repository.id}`);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const exactMatch = repositories.find(
      (repository) => repository.name.toLowerCase() === normalizedSearchQuery,
    );
    const repository = exactMatch ?? matchingRepositories[0];
    if (repository) {
      openRepository(repository);
      return;
    }

    if (normalizedSearchQuery) {
      setSearchError("No repository found with that name.");
    }
  };

  return (
    <header className="fixed right-0 top-0 z-40 h-16 border-b border-[#d7e7f7] bg-white/92 px-4 shadow-[0_10px_30px_rgba(37,99,235,0.08)] backdrop-blur lg:left-[260px]">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4">
        <form onSubmit={submitSearch} className="relative w-full max-w-2xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9ab0]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSearchError(null);
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 140)}
            className="h-10 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] pl-10 pr-3 text-sm text-[#172033] outline-none placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
            placeholder="Search repositories..."
          />

          {isSearchFocused && normalizedSearchQuery ? (
            <div className="absolute left-0 right-0 top-12 z-[85] overflow-hidden rounded-md border border-[#d7e7f7] bg-white shadow-[0_22px_65px_rgba(37,99,235,0.18)]">
              {matchingRepositories.length > 0 ? (
                matchingRepositories.map((repository) => (
                  <button
                    key={repository.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => openRepository(repository)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#eef5fc] px-4 py-3 text-left text-sm transition last:border-b-0 hover:bg-[#edf6ff]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-[#10213f]">{repository.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#52627a]">
                        {repository.language ?? "Repository"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-[#2563eb]">Open</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-[#52627a]">
                  {searchError ?? "No repositories match that name."}
                </div>
              )}
            </div>
          ) : null}
        </form>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d7e7f7] bg-[#f8fbff] text-[#52627a] transition-colors hover:border-[#38bdf8] hover:text-[#2563eb]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[11px] font-bold leading-5 text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 top-11 z-[80] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-[#d7e7f7] bg-white shadow-[0_22px_65px_rgba(37,99,235,0.18)]">
                <div className="flex items-center justify-between gap-3 border-b border-[#d7e7f7] px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-[#10213f]">Notifications</p>
                    <p className="text-xs text-[#52627a]">{unreadCount} unread</p>
                  </div>
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
                  >
                    Mark read
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[#52627a]">
                    No generated docs or diagrams yet.
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notification) => {
                      const Icon = notification.type === "documentation" ? FileText : GitBranch;

                      return (
                        <Link
                          key={notification.id}
                          href={notification.href}
                          onClick={() => {
                            markRead(notification.id);
                            setIsNotificationsOpen(false);
                          }}
                          className={`flex gap-3 border-b border-[#eef5fc] px-4 py-3 text-left transition last:border-b-0 hover:bg-[#edf6ff] ${
                            notification.isRead ? "bg-white" : "bg-[#f8fbff]"
                          }`}
                        >
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e0f2fe] text-[#2563eb]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-[#10213f]">
                              {notification.title}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-[#52627a]">
                              {notification.message}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {notifications.length > 0 ? (
                  <div className="border-t border-[#d7e7f7] px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="text-xs font-semibold text-[#ef4444] hover:text-[#b91c1c]"
                    >
                      Clear all
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-md bg-[#e0f2fe] text-xs font-bold text-[#0369a1] transition hover:bg-[#bfdbfe] hover:text-[#1d4ed8]"
            aria-label="Open profile settings"
          >
            {initials}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2563eb] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#1d4ed8]"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
