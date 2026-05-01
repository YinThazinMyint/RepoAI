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
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#e0f2fe] text-[#2563eb]">
                <FileCode2 className="h-5 w-5" />
              </div>
              <div>
                <Link
                  href={`/repositories/${repository.id}`}
                  className="text-base font-bold text-[#10213f] hover:text-[#2563eb]"
                >
                  {repository.name}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-[#52627a]">
                  {repository.description ?? "AI-generated insights, docs, and diagrams for this repository."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={repository.status} />
              <button
                type="button"
                onClick={() => onDelete?.(repository.id)}
                className="rounded-md p-2 text-[#8a9ab0] transition hover:bg-red-50 hover:text-red-600"
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

          <div className="flex items-center justify-between text-sm text-[#52627a]">
            <span>{repository.language ?? "Unknown language"}</span>
            <span>{formatDate(repository.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
