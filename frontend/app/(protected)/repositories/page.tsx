"use client";

import { AddRepositoryModal } from "@/components/add-repository-modal";
import { axiosInstance } from "@/lib/api";
import type { RepositorySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Folder, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RepositoriesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [openAddModal, setOpenAddModal] = useState(false);
  const [deletingRepositoryId, setDeletingRepositoryId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusLabel = (status: RepositorySummary["status"]) => {
    if (status === "ANALYZING") {
      return "Processing";
    }
    if (status === "PENDING") {
      return "Pending";
    }
    if (status === "ERROR") {
      return "Error";
    }
    return "Ready";
  };

  useEffect(() => {
    void axiosInstance
      .get<RepositorySummary[]>("/repositories")
      .then((response) => setRepositories(response.data))
      .catch(() => setRepositories([]));
  }, []);

  const deleteRepository = async (repository: RepositorySummary) => {
    const confirmed = window.confirm(`Delete "${repository.name}" and its generated docs, diagrams, and AI chat history?`);
    if (!confirmed) {
      return;
    }

    setDeletingRepositoryId(repository.id);
    setErrorMessage(null);

    try {
      await axiosInstance.delete(`/repositories/${repository.id}`);
      setRepositories((current) => current.filter((item) => item.id !== repository.id));
    } catch {
      setErrorMessage("Repository could not be deleted. Please try again.");
    } finally {
      setDeletingRepositoryId(null);
    }
  };

  return (
    <div className="rounded-md border border-[#d7e7f7] bg-white text-[#172033] shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
      <section className="flex items-center justify-between border-b border-[#d7e7f7] px-6 py-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">Codebases</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#10213f]">Repositories</h1>
        </div>
        <button
          type="button"
          onClick={() => setOpenAddModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
        >
          <Plus className="h-4 w-4" />
          Add Repository
        </button>
      </section>

      {errorMessage ? (
        <div className="mx-4 mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {repositories.map((repository) => (
          <article
            key={repository.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/repositories/${repository.id}`)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/repositories/${repository.id}`);
              }
            }}
            className="cursor-pointer rounded-md border border-[#d7e7f7] bg-[#f8fbff] p-4 transition hover:border-[#38bdf8] hover:bg-white hover:shadow-[0_12px_30px_rgba(37,99,235,0.12)]"
          >
            <div className="flex items-start gap-2">
              <Folder className="mt-0.5 h-4 w-4 text-[#2563eb]" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold text-[#10213f]">
                  {repository.name}
                </h2>
                <div className="mt-1">
                  <span className="inline-flex rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-0.5 text-xs font-semibold text-[#2563eb]">
                    {statusLabel(repository.status)}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-[#52627a]">
              {repository.description ?? "No description available."}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-[#d7e7f7] pt-2">
              <div className="flex items-center gap-2 text-xs text-[#52627a]">
                <span className="rounded-md border border-[#bae6fd] bg-[#f0f9ff] px-1.5 py-0.5 font-semibold text-[#0369a1]">
                  {repository.language ?? "Unknown"}
                </span>
                <span>{formatDate(repository.createdAt)}</span>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void deleteRepository(repository);
                }}
                disabled={deletingRepositoryId === repository.id}
                className="rounded p-1 text-[#8a9ab0] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Delete ${repository.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </article>
        ))}
      </section>

      <AddRepositoryModal open={openAddModal} onClose={() => setOpenAddModal(false)} />
    </div>
  );
}
