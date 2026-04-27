"use client";

import { axiosInstance } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import type { GitHubRepository } from "@/lib/types";
import type { RepositorySummary } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UploadMode = "github" | "zip";

export function UploadForm() {
  const { isAuthenticated, loginWithProvider, user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepository[]>([]);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<null | string>(null);
  const [messageType, setMessageType] = useState<"error" | "success">("success");

  useEffect(() => {
    if (mode !== "github" || !isAuthenticated || !user?.githubConnected) {
      return;
    }

    setIsLoadingRepositories(true);
    void axiosInstance
      .get<GitHubRepository[]>("/integrations/github/repositories")
      .then((response) => setGithubRepositories(response.data))
      .catch((error) => {
        console.error(error);
        setGithubRepositories([]);
        setMessageType("error");
        setMessage("GitHub repositories could not be loaded. Try reconnecting your GitHub account.");
      })
      .finally(() => setIsLoadingRepositories(false));
  }, [isAuthenticated, mode, user?.githubConnected]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "github" && !githubUrl.trim()) {
      setMessageType("error");
      setMessage("Please paste or choose a GitHub repository URL first.");
      return;
    }

    if (mode === "zip" && !zipFile) {
      setMessageType("error");
      setMessage("Please choose a ZIP file first.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      if (mode === "github" && githubUrl) {
        formData.append("githubUrl", githubUrl);
      }
      if (mode === "zip" && zipFile) {
        formData.append("zipFile", zipFile);
      }

      const response = await axiosInstance.post<RepositorySummary>("/repositories/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessageType("success");
      setMessage("Repository uploaded successfully. Opening generated overview...");
      setGithubUrl("");
      setZipFile(null);
      router.push(`/repositories/${response.data.id}`);
    } catch (error) {
      console.error(error);
      setMessageType("error");
      setMessage("Upload failed. Please try again. If it keeps failing, check the backend log.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel rounded-[2rem] p-6">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMode("github");
                setMessage(null);
              }}
              className={`rounded-[1.75rem] border p-5 text-left transition ${
                mode === "github"
                  ? "border-[color:var(--primary)] bg-[color:var(--ring)]"
                  : "border-[color:var(--border)] bg-[color:var(--panel-strong)]"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
                Option 1
              </p>
              <h3 className="mt-3 text-lg font-semibold">Connect GitHub account</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                Use GitHub integration when the user wants direct repo access and
                metadata import.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("zip");
                setMessage(null);
              }}
              className={`rounded-[1.75rem] border p-5 text-left transition ${
                mode === "zip"
                  ? "border-[color:var(--primary)] bg-[color:var(--ring)]"
                  : "border-[color:var(--border)] bg-[color:var(--panel-strong)]"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--muted)]">
                Option 2
              </p>
              <h3 className="mt-3 text-lg font-semibold">Upload project ZIP</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                Skip GitHub integration and upload a repository archive directly.
              </p>
            </button>
          </div>

          {mode === "github" ? (
            <div className="space-y-4 rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--panel-strong)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold">GitHub repository URL</label>
                  <p className="text-sm text-[color:var(--muted)]">
                    Use this path when the user wants GitHub-connected import.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loginWithProvider("github")}
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2 text-sm font-semibold transition hover:bg-[color:var(--ring)]"
                >
                  {user?.githubConnected ? "Reconnect GitHub" : "Connect GitHub"}
                </button>
              </div>

              <div className="rounded-2xl bg-[color:var(--background)] p-4 text-sm text-[color:var(--muted)]">
                {user?.githubConnected
                  ? `GitHub connected as ${user.username ?? user.email}. You can choose one of your repositories or paste a URL manually.`
                  : "GitHub is not connected yet. Connect your account to browse your repositories, or paste a GitHub URL manually."}
              </div>

              {user?.githubConnected ? (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold">Choose from connected GitHub repositories</label>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
                    {isLoadingRepositories ? (
                      <p className="text-sm text-[color:var(--muted)]">Loading repositories...</p>
                    ) : githubRepositories.length > 0 ? (
                      githubRepositories.map((repository) => (
                        <button
                          key={repository.id}
                          type="button"
                          onClick={() => setGithubUrl(repository.htmlUrl)}
                          className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                            githubUrl === repository.htmlUrl
                              ? "border-[color:var(--primary)] bg-[color:var(--ring)]"
                              : "border-[color:var(--border)] bg-[color:var(--panel-strong)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold">{repository.fullName}</p>
                              <p className="mt-1 text-xs text-[color:var(--muted)]">
                                {repository.language || "Unknown language"}
                              </p>
                            </div>
                            <span className="text-xs text-[color:var(--muted)]">
                              {repository.isPrivate ? "Private" : "Public"}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-[color:var(--muted)]">
                        No GitHub repositories were returned for this account.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <input
                type="url"
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/org/repository"
                className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 outline-none focus:border-[color:var(--primary)]"
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-semibold">ZIP Upload</label>
              <label className="grid-pattern flex min-h-44 cursor-pointer items-center justify-center rounded-[1.75rem] border border-dashed border-[color:var(--border)] bg-[color:var(--panel-strong)] px-6 text-center">
                <input
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
                />
                <div>
                  <p className="text-base font-semibold">
                    {zipFile ? zipFile.name : "Drop a ZIP archive or browse"}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Upload a compressed codebase when GitHub integration is not needed.
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="rounded-[1.75rem] bg-[linear-gradient(160deg,rgba(13,148,136,0.16),rgba(124,58,237,0.12))] p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">
            Submit
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">
            Start analysis
          </h3>
          <p className="mt-3 text-sm leading-7 text-[color:var(--muted)]">
            {mode === "github"
              ? "GitHub mode is for connected repository import and future account-based repo picking."
              : "ZIP mode is for local project uploads when GitHub integration is unnecessary."}
          </p>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-[color:var(--primary)] px-5 py-3 font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Uploading..."
              : mode === "github"
                ? "Import from GitHub"
                : "Upload ZIP Repository"}
          </button>

          {message ? (
            <p
              className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                messageType === "success"
                  ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
