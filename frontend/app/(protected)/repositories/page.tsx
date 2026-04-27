"use client";

import { AddRepositoryModal } from "@/components/add-repository-modal";
import { axiosInstance } from "@/lib/api";
import { mockRepositories } from "@/lib/mock-data";
import type { RepositorySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Folder, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function RepositoriesPage() {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositorySummary[]>(mockRepositories);
  const [openAddModal, setOpenAddModal] = useState(false);

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
      .catch(() => setRepositories(mockRepositories));
  }, []);

  return (
    <div className="rounded-md border border-black/50 bg-[#f6f6f6]">
      <section className="flex items-center justify-between border-b border-black/50 px-6 py-3">
        <h1 className="text-3xl font-semibold tracking-tight text-black">Repositories</h1>
        <button
          type="button"
          onClick={() => setOpenAddModal(true)}
          className="inline-flex items-center gap-2 rounded-sm border border-black/70 bg-[#f8f8f8] px-3 py-2 text-sm font-semibold text-black transition hover:bg-black/5"
        >
          <Plus className="h-4 w-4" />
          Add Repository
        </button>
      </section>

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
            className="cursor-pointer rounded-sm border border-black/55 bg-[#f9f9f9] p-3 transition hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-start gap-2">
              <Folder className="mt-0.5 h-4 w-4 text-black/80" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-black">
                  {repository.name}
                </h2>
                <div className="mt-1">
                  <span className="inline-flex rounded-sm border border-black/60 px-1.5 py-0.5 text-xs font-semibold text-black">
                    {statusLabel(repository.status)}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-black/75">
              {repository.description ?? "No description available."}
            </p>

            <div className="mt-3 flex items-center justify-between border-t border-black/30 pt-2">
              <div className="flex items-center gap-2 text-xs text-black/70">
                <span className="rounded-sm border border-black/55 px-1.5 py-0.5 font-medium text-black">
                  {repository.language ?? "Unknown"}
                </span>
                <span>{formatDate(repository.createdAt)}</span>
              </div>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="rounded p-1 text-black/60 transition hover:bg-black/5 hover:text-black"
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
