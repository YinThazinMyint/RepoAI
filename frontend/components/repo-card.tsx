"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileCode2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import type { RepositorySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function RepoCard({
  onDelete,
  repository,
}: {
  onDelete?: (id: number) => void;
  repository: RepositorySummary;
}) {
  return (
    <motion.div whileHover={{ y: -4 }}>
      <Card className="overflow-hidden">
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f1117] text-[#0d9488]">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <Link
                  href={`/repositories/${repository.id}`}
                  className="text-base font-semibold text-slate-50 hover:text-[#0d9488]"
                >
                  {repository.name}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-[#64748b]">
                  {repository.description ?? "AI-generated insights, docs, and diagrams for this repository."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={repository.status} />
              <button
                type="button"
                onClick={() => onDelete?.(repository.id)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-[#0f1117] hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(repository.techStack ?? [repository.language ?? "Unknown"]).map((tag) => (
              <Badge key={tag} variant={tag === repository.language ? "teal" : "accent"}>
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-[#64748b]">
            <span>{repository.language ?? "Unknown language"}</span>
            <span>{formatDate(repository.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
