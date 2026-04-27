"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { RepositoryStatus } from "@/lib/types";
import { statusLabel } from "@/lib/utils";

const variantMap: Record<RepositoryStatus, "error" | "muted" | "success" | "warning"> = {
  ANALYZING: "warning",
  ERROR: "error",
  PENDING: "muted",
  READY: "success",
};

export function StatusBadge({ status }: { status: RepositoryStatus }) {
  if (status === "ANALYZING") {
    return (
      <motion.div
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}
      >
        <Badge variant={variantMap[status]}>{statusLabel(status)}</Badge>
      </motion.div>
    );
  }

  return <Badge variant={variantMap[status]}>{statusLabel(status)}</Badge>;
}
