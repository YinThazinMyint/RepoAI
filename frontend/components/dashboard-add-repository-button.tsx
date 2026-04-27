"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddRepositoryModal } from "@/components/add-repository-modal";

export function DashboardAddRepositoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
      >
        <Plus className="h-4 w-4" />
        Add Repository
      </button>
      <AddRepositoryModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
