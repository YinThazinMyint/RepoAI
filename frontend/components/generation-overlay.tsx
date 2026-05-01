"use client";

import { Sparkles } from "lucide-react";

type GenerationOverlayProps = {
  description?: string;
  open: boolean;
  title: string;
};

export function GenerationOverlay({
  description = "This can take a little while for larger repositories.",
  open,
  title,
}: GenerationOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#10213f]/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-md border border-[#d7e7f7] bg-white p-6 text-center shadow-[0_24px_70px_rgba(37,99,235,0.22)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-[#eff6ff] text-[#2563eb]">
          <Sparkles className="h-7 w-7 animate-pulse" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#10213f]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#52627a]">{description}</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#dbeafe]">
          <div className="h-full w-1/2 animate-[loading-slide_1.2s_ease-in-out_infinite] rounded-full bg-[#2563eb]" />
        </div>
      </div>
    </div>
  );
}
