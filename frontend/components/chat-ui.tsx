"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { axiosInstance } from "@/lib/api";
import type { RepositorySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type AIQuestionResponse = {
  answerText?: string;
  id: number;
  questionText?: string;
  respondedAt?: string;
};

type RepositoryQuestionResponse = {
  questions: AIQuestionResponse[];
};

export function ChatUI() {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [conversation, setConversation] = useState<AIQuestionResponse[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(true);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoadingRepositories(true);
    void axiosInstance
      .get<RepositorySummary[]>("/repositories")
      .then((response) => {
        setRepositories(response.data);
        if (response.data.length > 0) {
          setSelectedRepositoryId(String(response.data[0].id));
        }
      })
      .catch(() => {
        setRepositories([]);
        setErrorMessage("Repositories could not be loaded. Upload one first to ask codebase questions.");
      })
      .finally(() => setIsLoadingRepositories(false));
  }, []);

  useEffect(() => {
    if (!selectedRepositoryId) {
      setConversation([]);
      return;
    }

    setIsLoadingConversation(true);
    void axiosInstance
      .get<RepositoryQuestionResponse>(`/repositories/${selectedRepositoryId}`)
      .then((response) => {
        setConversation(response.data.questions ?? []);
        setErrorMessage(null);
      })
      .catch(() => {
        setConversation([]);
        setErrorMessage("Questions could not be loaded for the selected repository.");
      })
      .finally(() => setIsLoadingConversation(false));
  }, [selectedRepositoryId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !selectedRepositoryId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await axiosInstance.post<AIQuestionResponse>(
        `/repositories/${selectedRepositoryId}/questions`,
        { questionText: trimmedQuestion },
      );

      setConversation((current) => [...current, response.data]);
      setQuestion("");
    } catch {
      setErrorMessage("The AI answer could not be generated. Check the backend log and OpenAI configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-md border border-black/60 bg-[#f7f7f7] p-4 text-black">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">AI Chat</h2>
          <p className="mt-1 text-sm text-black/65">
            Select a repository first, then ask questions about that specific codebase.
          </p>
        </div>

        <div className="min-w-[220px] space-y-1.5">
          <label className="block text-sm font-medium">Repository</label>
          <select
            value={selectedRepositoryId}
            onChange={(event) => setSelectedRepositoryId(event.target.value)}
            disabled={isLoadingRepositories || repositories.length === 0}
            className="w-full rounded-md border border-black/35 bg-[#fbfbfb] px-3 py-2 text-sm outline-none focus:border-black/70 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoadingRepositories ? (
              <option value="">Loading repositories...</option>
            ) : repositories.length === 0 ? (
              <option value="">No uploaded repositories available</option>
            ) : (
              repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {selectedRepositoryId ? (
          <p className="text-sm text-black/65">
            Showing conversation for{" "}
            <span className="font-semibold text-black">
              {repositories.find((repository) => String(repository.id) === selectedRepositoryId)?.name ?? "Selected repository"}
            </span>
            .
          </p>
        ) : null}
        {errorMessage ? (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </div>

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-md border border-black/35 bg-[#fbfbfb] p-3">
        {isLoadingConversation ? (
          <div className="rounded-md border border-dashed border-black/35 px-4 py-8 text-center text-sm text-black/55">
            Loading conversation...
          </div>
        ) : conversation.length === 0 ? (
          <div className="rounded-md border border-dashed border-black/35 px-4 py-8 text-center text-sm text-black/55">
            No saved conversation yet for this repository. Ask the first question to start.
          </div>
        ) : (
          conversation.map((message) => (
            <div key={message.id} className="space-y-2">
              <div className="ml-auto max-w-[88%] rounded-md border border-black bg-black px-3 py-2 text-sm text-white">
                {message.questionText}
              </div>

              <div className="max-w-[92%] rounded-md border border-black/35 bg-white px-3 py-2 text-sm text-black">
                <div className="markdown-body">
                  <ReactMarkdown>{message.answerText ?? "Thinking..."}</ReactMarkdown>
                </div>
                {message.respondedAt ? (
                  <p className="mt-2 text-xs text-black/55">
                    {formatDate(message.respondedAt)}
                  </p>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={4}
          placeholder="Ask a question about the selected repository..."
          className="w-full rounded-md border border-black/35 bg-[#fbfbfb] px-3 py-2 text-sm outline-none focus:border-black/70"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !selectedRepositoryId}
            className="rounded-md border border-black bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send question"}
          </button>
        </div>
      </form>
    </section>
  );
}
