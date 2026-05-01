import { MessagesSquare, Sparkles } from "lucide-react";
import { ChatUI } from "@/components/chat-ui";
import { fetchRecentQuestions } from "@/lib/server-api";

const promptIdeas = [
  "Give me the architecture overview for this repository.",
  "What files should a new developer read first?",
  "Explain the upload and analysis flow end to end.",
  "Summarize backend auth and token handling.",
];

export default async function AIToolsPage() {
  const recentQuestions = await fetchRecentQuestions();

  return (
    <div className="space-y-4 text-[#172033]">
      <section className="rounded-md border border-[#d7e7f7] bg-white px-6 py-4 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">Assistant</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#10213f]">AI Chat</h1>
        <p className="mt-1 text-sm text-[#52627a]">
          Select a repository and ask questions to get repository-specific AI answers.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <ChatUI />

        <div className="space-y-4">
          <section className="rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
            <div className="border-b border-[#d7e7f7] px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#2563eb]" />
                <h2 className="text-lg font-bold tracking-tight text-[#10213f]">Prompt Ideas</h2>
              </div>
            </div>
            <div className="space-y-2 px-4 py-3">
              {promptIdeas.map((prompt) => (
                <div key={prompt} className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-3 py-2 text-sm text-[#52627a]">
                  {prompt}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
            <div className="border-b border-[#d7e7f7] px-4 py-3">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4 text-[#2563eb]" />
                <h2 className="text-lg font-bold tracking-tight text-[#10213f]">Recent Questions</h2>
              </div>
            </div>
            <div className="space-y-2 px-4 py-3">
              {recentQuestions.map((question) => (
                <div key={question.id} className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-3 py-2">
                  <p className="text-sm font-semibold text-[#10213f]">{question.questionText}</p>
                  <p className="mt-1 text-xs text-[#8a9ab0]">{question.questionType ?? "Question"}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
