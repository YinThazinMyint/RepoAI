"use client";

import Link from "next/link";
import { DashboardAddRepositoryButton } from "@/components/dashboard-add-repository-button";
import { axiosInstance } from "@/lib/api";
import type { AIMessage, DashboardStats, RepositorySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";

const statCards = [
  { key: "repositories", label: "Repositories" },
  { key: "questions", label: "AI Questions" },
  { key: "docs", label: "Documents" },
  { key: "diagrams", label: "Diagrams" },
] as const;

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const formatRelativeTime = (value?: string) => {
  if (!value) {
    return "Unknown time";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatDate(value);
  }

  const diffMs = parsed.getTime() - Date.now();
  const seconds = Math.round(diffMs / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(days) >= 7) {
    return formatDate(value);
  }
  if (Math.abs(days) >= 1) {
    return relativeTimeFormatter.format(days, "day");
  }
  if (Math.abs(hours) >= 1) {
    return relativeTimeFormatter.format(hours, "hour");
  }
  if (Math.abs(minutes) >= 1) {
    return relativeTimeFormatter.format(minutes, "minute");
  }

  return relativeTimeFormatter.format(seconds, "second");
};

const emptyStats: DashboardStats = {
  diagrams: 0,
  docs: 0,
  questions: 0,
  repositories: 0,
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<AIMessage[]>([]);

  useEffect(() => {
    void Promise.all([
      axiosInstance.get<DashboardStats>("/dashboard/stats"),
      axiosInstance.get<RepositorySummary[]>("/repositories"),
      axiosInstance.get<AIMessage[]>("/dashboard/recent-questions"),
    ])
      .then(([statsResponse, repositoriesResponse, questionsResponse]) => {
        setStats(statsResponse.data);
        setRepositories(repositoriesResponse.data);
        setRecentQuestions(questionsResponse.data);
      })
      .catch(() => {
        setStats(emptyStats);
        setRepositories([]);
        setRecentQuestions([]);
      });
  }, []);

  return (
    <div className="space-y-6 text-[#172033]">
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">Workspace</p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-[#10213f]">Dashboard</h1>
        </div>
        <DashboardAddRepositoryButton />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const value = stats[card.key];

          return (
            <div
              key={card.key}
              className="rounded-md border border-[#d7e7f7] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(37,99,235,0.08)]"
            >
              <p className="text-5xl font-bold leading-none text-[#2563eb]">{value}</p>
              <p className="mt-2 text-base font-semibold text-[#52627a]">{card.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)] lg:col-span-2">
          <div className="border-b border-[#d7e7f7] px-5 py-4">
            <h2 className="text-[30px] font-bold tracking-tight text-[#10213f]">Recent Repositories</h2>
          </div>
          <div>
            {repositories.length === 0 ? (
              <p className="px-5 py-5 text-sm text-[#52627a]">No repositories added yet.</p>
            ) : (
              repositories.slice(0, 5).map((repository, index) => (
                <div
                  key={repository.id}
                  className={`px-5 py-4 ${index > 0 ? "border-t border-[#d7e7f7]" : ""}`}
                >
                  <Link
                    href={`/repositories/${repository.id}`}
                    className="text-xl font-bold tracking-tight text-[#10213f] hover:text-[#2563eb]"
                  >
                    {repository.name}
                  </Link>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <span className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 font-semibold text-[#2563eb]">
                      {repository.language ?? "Unknown"}
                    </span>
                    <span className="text-[#52627a]">{formatRelativeTime(repository.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
          <div className="border-b border-[#d7e7f7] px-5 py-4">
            <h2 className="text-[30px] font-bold tracking-tight text-[#10213f]">Recent Activity</h2>
          </div>
          <div>
            {recentQuestions.length === 0 ? (
              <p className="px-5 py-5 text-sm text-[#52627a]">No recent activity.</p>
            ) : (
              recentQuestions.slice(0, 5).map((question, index) => (
                <div key={question.id} className={`px-5 py-4 ${index > 0 ? "border-t border-[#d7e7f7]" : ""}`}>
                  <p className="text-lg font-bold tracking-tight text-[#10213f]">{question.questionText}</p>
                  <p className="mt-1 text-sm text-[#52627a]">{question.repositoryName ?? "Unknown repository"}</p>
                  <p className="mt-1 text-sm text-[#8a9ab0]">
                    {formatRelativeTime(question.respondedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
