"use client";

import { useEffect, useState } from "react";
import { axiosInstance } from "@/lib/api";
import { mockRepositories } from "@/lib/mock-data";
import type { RepositorySummary } from "@/lib/types";
import { RepoCard } from "./repo-card";

function RepoCardSkeleton() {
  return (
    <div className="glass-panel animate-pulse rounded-3xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="h-5 w-40 rounded-full bg-[color:var(--ring)]" />
          <div className="mt-3 h-4 w-3/4 rounded-full bg-[color:var(--ring)]" />
        </div>
        <div className="h-7 w-24 rounded-full bg-[color:var(--ring)]" />
      </div>
      <div className="mt-6 flex gap-3">
        <div className="h-8 w-28 rounded-full bg-[color:var(--ring)]" />
        <div className="h-8 w-36 rounded-full bg-[color:var(--ring)]" />
      </div>
    </div>
  );
}

export function RepoList() {
  const [repositories, setRepositories] =
    useState<RepositorySummary[]>(mockRepositories);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void axiosInstance
      .get<RepositorySummary[]>("/repositories")
      .then((response) => setRepositories(response.data))
      .catch(() => setRepositories(mockRepositories))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-[-0.04em]">Repositories</h2>
        <p className="text-sm text-[color:var(--muted)]">
          {isLoading ? "Loading repositories..." : `${repositories.length} loaded`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }, (_, index) => (
              <RepoCardSkeleton key={`repo-skeleton-${index}`} />
            ))
          : repositories.map((repository) => (
              <RepoCard key={repository.id} repository={repository} />
            ))}
      </div>
    </section>
  );
}
