"use client";

import { Suspense, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter, useSearchParams } from "next/navigation";

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSessionFromToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.replace("/login?error=missing_token");
      return;
    }

    void setSessionFromToken(token).then(() => router.replace("/upload"));
  }, [router, searchParams, setSessionFromToken]);

  return (
    <div className="glass-panel rounded-3xl px-8 py-6 text-sm text-[color:var(--muted)]">
      Finishing GitHub sign-in...
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <main className="grid min-h-screen place-items-center">
      <Suspense
        fallback={
          <div className="glass-panel rounded-3xl px-8 py-6 text-sm text-[color:var(--muted)]">
            Preparing secure callback...
          </div>
        }
      >
        <OAuthCallbackContent />
      </Suspense>
    </main>
  );
}
