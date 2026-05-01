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
        className="inline-flex items-center gap-2 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
      >
        <Plus className="h-4 w-4" />
        Add Repository
      </button>
      <AddRepositoryModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
