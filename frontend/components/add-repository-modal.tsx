"use client";

import { useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { Github, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { axiosInstance } from "@/lib/api";
import type { RepositorySummary } from "@/lib/types";

type AddRepositoryModalProps = {
  onClose: () => void;
  open: boolean;
};

type UploadTab = "github" | "zip";
type RepositoryVisibility = "private" | "public";

export function AddRepositoryModal({ onClose, open }: AddRepositoryModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const backendBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api")
    .replace(/\/api$/, "");
  const [tab, setTab] = useState<UploadTab>("github");
  const [repositoryVisibility, setRepositoryVisibility] = useState<RepositoryVisibility>("public");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  const submit = async () => {
    const resolvedName = name.trim();
    const resolvedGithubUrl = githubUrl.trim();

    if (!resolvedName) {
      setError("Repository name is required.");
      return;
    }

    if (tab === "github" && !resolvedGithubUrl) {
      setError("GitHub URL is required.");
      return;
    }

    if (tab === "github" && repositoryVisibility === "private" && !user?.githubConnected) {
      setError("Private repositories require GitHub connection.");
      return;
    }

    if (tab === "github" && !/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/.test(resolvedGithubUrl.replace(/\.git$/, ""))) {
      setError("Enter a valid GitHub repository URL, for example https://github.com/user/repo.");
      return;
    }

    if (tab === "zip" && !zipFile) {
      setError("ZIP file is required.");
      return;
    }

    if (tab === "zip" && zipFile && !zipFile.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip repository archives are supported.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("name", resolvedName);
      formData.append("description", description);
      if (tab === "github") {
        formData.append("githubUrl", resolvedGithubUrl);
        formData.append("repositoryVisibility", repositoryVisibility);
      }
      if (tab === "zip" && zipFile) {
        formData.append("zipFile", zipFile);
      }

      const response = await axiosInstance.post<RepositorySummary>("/repositories/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      onClose();
      router.push(`/repositories/${response.data.id}`);
    } catch (submissionError) {
      console.error(submissionError);
      if (axios.isAxiosError(submissionError)) {
        setError(submissionError.response?.data?.message ?? "Unable to add repository right now.");
      } else {
        setError("Unable to add repository right now.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const connectGithub = () => {
    window.location.href = `${backendBaseUrl}/oauth2/authorization/github`;
  };

  const shouldShowGithubConnect =
    repositoryVisibility === "private"
    && (error?.toLowerCase().includes("private")
      || error?.toLowerCase().includes("connect github")
      || error?.toLowerCase().includes("github connection"));

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          onClick={closeModal}
        >
            <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="w-full"
            style={{ maxWidth: 380 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="rounded-xl border border-black/20 bg-[#f3f4f6] p-3 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.2)]"
              style={{ fontSize: 14 }}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-black">Add Repository</h2>
                    <p className="mt-1 text-[12px] text-[#667085]">
                      Paste a public GitHub URL, connect GitHub for private repos, or upload a ZIP.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md p-1.5 text-black/60 transition hover:bg-black/5 hover:text-black"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("github")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                      tab === "github"
                        ? "border-[#22b8a9] bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                        : "border-transparent bg-[#eef0f3] text-[#6b7280]"
                    }`}
                  >
                    <Github className="h-4 w-4" />
                    GitHub URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("zip")}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                      tab === "zip"
                        ? "border-[#22b8a9] bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                        : "border-transparent bg-[#eef0f3] text-[#6b7280]"
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    Upload ZIP
                  </button>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-black">Repository Name</label>
                    <input
                      placeholder="my-awesome-project"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-9 w-full rounded-lg border border-[#d2d7de] bg-[#f7f8fa] px-3 text-[14px] text-black outline-none placeholder:text-[#7b8496] focus:border-[#22b8a9]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-black">Description (optional)</label>
                    <textarea
                      placeholder="Brief description of the project..."
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className="min-h-[64px] w-full resize-y rounded-lg border border-[#d2d7de] bg-[#f7f8fa] px-3 py-2 text-[14px] text-black outline-none placeholder:text-[#7b8496] focus:border-[#22b8a9]"
                    />
                  </div>

                  {tab === "github" ? (
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-black">GitHub URL</label>
                      <p className="text-[12px] leading-5 text-[#667085]">
                        Choose public to scan by URL only. Choose private when the repo needs GitHub access.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRepositoryVisibility("public");
                            setError(null);
                          }}
                          className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
                            repositoryVisibility === "public"
                              ? "border-[#22b8a9] bg-white text-black"
                              : "border-[#d2d7de] bg-[#eef0f3] text-[#667085]"
                          }`}
                        >
                          Public URL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRepositoryVisibility("private");
                            setError(null);
                          }}
                          className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition ${
                            repositoryVisibility === "private"
                              ? "border-[#22b8a9] bg-white text-black"
                              : "border-[#d2d7de] bg-[#eef0f3] text-[#667085]"
                          }`}
                        >
                          Private Repo
                        </button>
                      </div>
                      {repositoryVisibility === "private" && !user?.githubConnected ? (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                          Private import needs GitHub connection.
                          <button
                            type="button"
                            onClick={connectGithub}
                            className="ml-2 font-semibold underline"
                          >
                            Connect GitHub
                          </button>
                        </div>
                      ) : null}
                      <input
                        placeholder="https://github.com/user/repo"
                        value={githubUrl}
                        onChange={(event) => setGithubUrl(event.target.value)}
                        className="h-9 w-full rounded-lg border border-[#d2d7de] bg-[#f7f8fa] px-3 text-[14px] text-black outline-none placeholder:text-[#7b8496] focus:border-[#22b8a9]"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium text-black">ZIP File</label>
                      <label className="flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-[#d3d9e1] bg-[#f7f8fa] px-4 text-center">
                        <input
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
                        />
                        <Upload className="h-5 w-5 text-[#697386]" />
                        <span className="text-[13px] text-[#697386]">
                          {zipFile ? zipFile.name : "Click to select a ZIP file"}
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {error ? (
                  <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p>{error}</p>
                    {shouldShowGithubConnect ? (
                      <button
                        type="button"
                        onClick={connectGithub}
                        className="inline-flex rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white transition hover:bg-black/80"
                      >
                        Connect GitHub
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={closeModal}
                    disabled={isSubmitting}
                    className="h-9 rounded-lg border-[#d2d7de] bg-[#f8f9fb] px-4 text-[13px] font-medium text-black hover:bg-[#eef1f5]"
                  >
                    Cancel
                  </Button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={isSubmitting}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-[#88d8d0] px-4 text-[13px] font-semibold text-white transition hover:bg-[#74cbc2] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? "Adding..." : "Add Repository"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
