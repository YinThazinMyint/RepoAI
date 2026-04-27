import type {
  AIMessage,
  DashboardStats,
  GitHubRepository,
  QuestionHistoryItem,
  RecentRepository,
  RepoDiagram,
  RepoDocument,
  RepositoryDetail,
  RepositorySummary,
  UserProfile,
} from "./types";

export const mockUser: UserProfile = {
  avatarUrl: "https://avatars.githubusercontent.com/u/14957082?v=4",
  email: "octo.analyst@repoai.dev",
  githubConnected: true,
  id: 1,
  name: "Octo Analyst",
  provider: "GITHUB",
  username: "octo-analyst",
};

export const mockStats: DashboardStats = {
  diagrams: 16,
  docs: 24,
  questions: 38,
  repositories: 6,
};

export const mockRepositories: RepositorySummary[] = [
  {
    createdAt: "2026-03-31T09:14:00Z",
    description: "App Router frontend for AI-powered repository exploration and workflow orchestration.",
    fileCount: 184,
    githubUrl: "https://github.com/openai/repoai-web",
    id: 1,
    language: "TypeScript",
    linesOfCode: 18432,
    name: "repoai-web",
    status: "READY",
    techStack: ["Next.js", "Tailwind CSS", "Framer Motion"],
  },
  {
    createdAt: "2026-03-30T18:20:00Z",
    description: "Spring Boot backend for uploads, auth, AI generation, and repository metadata processing.",
    fileCount: 96,
    githubUrl: "https://github.com/openai/repoai-backend",
    id: 2,
    language: "Java",
    linesOfCode: 13240,
    name: "repoai-backend",
    status: "ANALYZING",
    techStack: ["Spring Boot", "PostgreSQL", "OpenAI"],
  },
  {
    createdAt: "2026-03-29T08:05:00Z",
    description: "ZIP-uploaded data platform with ingestion services, async workers, and analytics endpoints.",
    fileCount: 61,
    id: 3,
    language: "Python",
    linesOfCode: 7810,
    name: "insight-pipeline",
    status: "PENDING",
    techStack: ["FastAPI", "Redis", "Celery"],
  },
  {
    createdAt: "2026-03-28T12:12:00Z",
    description: "Legacy service currently failing dependency resolution during static analysis.",
    fileCount: 41,
    id: 4,
    language: "JavaScript",
    linesOfCode: 4921,
    name: "legacy-admin-portal",
    status: "ERROR",
    techStack: ["Express", "MongoDB"],
  },
];

export const recentRepositories: RecentRepository[] = mockRepositories.slice(0, 4);

export const recentQuestions: QuestionHistoryItem[] = [
  {
    answerText: "The upload path hands off to metadata extraction, then doc and diagram generation.",
    id: 5001,
    questionText: "How does the upload pipeline work?",
    questionType: "Architecture",
    repositoryName: "repoai-backend",
    respondedAt: "2026-03-31T10:03:00Z",
  },
  {
    answerText: "The Next.js app uses App Router with protected layouts and a fixed shell.",
    id: 5002,
    questionText: "What frontend structure is used here?",
    questionType: "Code Review",
    repositoryName: "repoai-web",
    respondedAt: "2026-03-31T09:28:00Z",
  },
  {
    answerText: "The worker queue is driven by Redis and background jobs.",
    id: 5003,
    questionText: "Where is async processing handled?",
    questionType: "Architecture",
    repositoryName: "insight-pipeline",
    respondedAt: "2026-03-30T17:42:00Z",
  },
];

export const mockDocuments: RepoDocument[] = [
  {
    content: `# Overview\n\nRepoAI ingests repositories, extracts metadata, generates docs and diagrams, and supports AI Q&A for rapid onboarding.`,
    id: 101,
    repositoryName: "repoai-web",
    title: "Overview",
    type: "Overview",
    updatedAt: "2026-03-31T08:20:00Z",
  },
  {
    content: `# Setup Guide\n\n1. Install dependencies\n2. Configure env vars\n3. Run backend and frontend\n4. Connect OAuth providers`,
    id: 102,
    repositoryName: "repoai-backend",
    title: "Setup Guide",
    type: "Setup Guide",
    updatedAt: "2026-03-31T07:45:00Z",
  },
  {
    content: `# Module Docs\n\nThe platform is split into auth, uploads, repository intelligence, and AI generation domains.`,
    id: 103,
    repositoryName: "repoai-backend",
    title: "Module Documentation",
    type: "Module Docs",
    updatedAt: "2026-03-30T21:10:00Z",
  },
];

export const mockDiagrams: RepoDiagram[] = [
  {
    id: 201,
    mermaidCode: `flowchart LR
  A[OAuth Login] --> B[Spring Security]
  B --> C[Upload Service]
  C --> D[OpenAI Generation]
  D --> E[(PostgreSQL)]`,
    title: "Repository Processing Flow",
    type: "Flowchart",
    updatedAt: "2026-03-31T08:55:00Z",
  },
  {
    id: 202,
    mermaidCode: `flowchart TD
  UI[Next.js UI] --> API[Spring Boot API]
  API --> AUTH[Auth Domain]
  API --> REPOS[Repository Domain]
  API --> AI[AI Generation Domain]
  REPOS --> DB[(PostgreSQL)]`,
    title: "Platform Architecture",
    type: "Architecture",
    updatedAt: "2026-03-30T19:33:00Z",
  },
];

export const mockConversation: AIMessage[] = [
  {
    answerText: "This repository is organized around uploads, auth, and AI generation, with generated artifacts persisted for later retrieval.",
    id: 301,
    questionText: "Give me the high-level purpose of this repo.",
    questionType: "Overview",
    referencedFiles: ["RepositoryService.java", "SecurityConfig.java"],
    respondedAt: "2026-03-31T09:10:00Z",
  },
  {
    answerText: "The most important flows are login, repository upload, overview generation, and repository detail exploration.",
    id: 302,
    questionText: "What flows should I understand first?",
    questionType: "Architecture",
    referencedFiles: ["UploadForm.tsx", "RepositoryController.java"],
    respondedAt: "2026-03-31T09:11:00Z",
  },
];

export const mockRepositoryDetail: RepositoryDetail = {
  diagrams: mockDiagrams,
  docs: mockDocuments,
  questions: mockConversation,
  repository: mockRepositories[0],
};

export const mockGitHubRepositories: GitHubRepository[] = [
  {
    fullName: "octo-analyst/repoai-web",
    htmlUrl: "https://github.com/octo-analyst/repoai-web",
    id: 1001,
    isPrivate: false,
    language: "TypeScript",
    name: "repoai-web",
  },
  {
    fullName: "octo-analyst/repoai-backend",
    htmlUrl: "https://github.com/octo-analyst/repoai-backend",
    id: 1002,
    isPrivate: true,
    language: "Java",
    name: "repoai-backend",
  },
];
