import Link from "next/link";
import { DashboardAddRepositoryButton } from "@/components/dashboard-add-repository-button";
import { fetchDashboardStats, fetchRecentQuestions, fetchRepositories } from "@/lib/server-api";
import { formatDate } from "@/lib/utils";

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

export default async function DashboardPage() {
  const [stats, repositories, recentQuestions] = await Promise.all([
    fetchDashboardStats(),
    fetchRepositories(),
    fetchRecentQuestions(),
  ]);

  return (
    <div className="space-y-6 text-black">
      <section className="flex items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
        <DashboardAddRepositoryButton />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const value = stats[card.key];

          return (
            <div
              key={card.key}
              className="rounded-md border border-black/60 bg-[#f6f6f6] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.08)]"
            >
              <p className="text-5xl font-semibold leading-none">{value}</p>
              <p className="mt-2 text-base font-semibold">{card.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-md border border-black/70 bg-[#f6f6f6] lg:col-span-2">
          <div className="border-b border-black/70 px-5 py-4">
            <h2 className="text-[30px] font-semibold tracking-tight">Recent Repositories</h2>
          </div>
          <div>
            {repositories.length === 0 ? (
              <p className="px-5 py-5 text-sm text-black/60">No repositories added yet.</p>
            ) : (
              repositories.slice(0, 5).map((repository, index) => (
                <div
                  key={repository.id}
                  className={`px-5 py-4 ${index > 0 ? "border-t border-black/35" : ""}`}
                >
                  <Link
                    href={`/repositories/${repository.id}`}
                    className="text-xl font-semibold tracking-tight hover:underline"
                  >
                    {repository.name}
                  </Link>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <span className="rounded border border-black/60 px-2 py-0.5 font-medium">
                      {repository.language ?? "Unknown"}
                    </span>
                    <span className="text-black/65">{formatRelativeTime(repository.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-black/70 bg-[#f6f6f6]">
          <div className="border-b border-black/70 px-5 py-4">
            <h2 className="text-[30px] font-semibold tracking-tight">Recent Activity</h2>
          </div>
          <div>
            {recentQuestions.length === 0 ? (
              <p className="px-5 py-5 text-sm text-black/60">No recent activity.</p>
            ) : (
              recentQuestions.slice(0, 5).map((question, index) => (
                <div key={question.id} className={`px-5 py-4 ${index > 0 ? "border-t border-black/35" : ""}`}>
                  <p className="text-lg font-semibold tracking-tight">{question.questionText}</p>
                  <p className="mt-1 text-sm text-black/70">{question.repositoryName ?? "Unknown repository"}</p>
                  <p className="mt-1 text-sm text-black/65">
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
