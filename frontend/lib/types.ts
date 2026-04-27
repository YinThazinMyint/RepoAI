export type RepositoryStatus = "ANALYZING" | "ERROR" | "PENDING" | "READY";

export type UserProfile = {
  avatarUrl?: string;
  email: string;
  githubConnected?: boolean;
  id: number | string;
  name: string;
  provider?: "GITHUB" | "GOOGLE" | "LOCAL" | string;
  username?: string;
};

export type GitHubRepository = {
  fullName: string;
  htmlUrl: string;
  id: number;
  isPrivate: boolean;
  language?: string;
  name: string;
};

export type DashboardStats = {
  diagrams: number;
  docs: number;
  questions: number;
  repositories: number;
};

export type RepositorySummary = {
  createdAt: string;
  description?: string;
  fileCount?: number;
  githubUrl?: string;
  id: number;
  language?: string;
  linesOfCode?: number;
  name: string;
  status: RepositoryStatus;
  techStack?: string[];
};

export type AIMessage = {
  answerText?: string;
  askedAt?: string;
  id: number;
  questionText: string;
  questionType?: string;
  referencedFiles?: string[];
  repositoryName?: string;
  respondedAt?: string;
};

export type RepoDocument = {
  content: string;
  createdAt?: string;
  id: number;
  repositoryId?: number;
  repositoryName?: string;
  title: string;
  type?: "API Docs" | "Contributing" | "Module Docs" | "Overview" | "Setup Guide" | string;
  updatedAt?: string;
};

export type RepoDiagram = {
  createdAt?: string;
  id: number;
  mermaidCode: string;
  title: string;
  type: "Architecture" | "Class" | "ER Diagram" | "Flowchart" | "Sequence";
  updatedAt?: string;
};

export type RepositoryDetail = {
  diagrams: RepoDiagram[];
  docs: RepoDocument[];
  questions: AIMessage[];
  repository: RepositorySummary;
};

export type RecentRepository = RepositorySummary;

export type QuestionHistoryItem = AIMessage;
