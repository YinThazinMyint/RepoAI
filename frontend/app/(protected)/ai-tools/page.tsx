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
    <div className="space-y-4 text-black">
      <section className="rounded-md border border-black/50 bg-[#f6f6f6] px-6 py-4">
        <h1 className="text-3xl font-semibold tracking-tight">AI Chat</h1>
        <p className="mt-1 text-sm text-black/65">
          Select a repository and ask questions to get repository-specific AI answers.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_0.85fr]">
        <ChatUI />

        <div className="space-y-4">
          <section className="rounded-md border border-black/60 bg-[#f7f7f7]">
            <div className="border-b border-black/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <h2 className="text-lg font-semibold tracking-tight">Prompt Ideas</h2>
              </div>
            </div>
            <div className="space-y-2 px-4 py-3">
              {promptIdeas.map((prompt) => (
                <div key={prompt} className="rounded-sm border border-black/30 bg-[#fafafa] px-3 py-2 text-sm">
                  {prompt}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-black/60 bg-[#f7f7f7]">
            <div className="border-b border-black/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4" />
                <h2 className="text-lg font-semibold tracking-tight">Recent Questions</h2>
              </div>
            </div>
            <div className="space-y-2 px-4 py-3">
              {recentQuestions.map((question) => (
                <div key={question.id} className="rounded-sm border border-black/30 bg-[#fafafa] px-3 py-2">
                  <p className="text-sm font-medium">{question.questionText}</p>
                  <p className="mt-1 text-xs text-black/55">{question.questionType ?? "Question"}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
