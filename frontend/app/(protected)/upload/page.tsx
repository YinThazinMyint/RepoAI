import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.4em] text-[color:var(--muted)]">
          Upload
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
          Add a repository for analysis
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-8 text-[color:var(--muted)]">
          Connect a GitHub repository directly or drop in a ZIP archive to extract
          structure, metadata, diagrams, and AI-ready documentation.
        </p>
      </section>

      <UploadForm />
    </div>
  );
}
