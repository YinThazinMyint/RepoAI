import { mockRepositoryDetail, mockUser } from "./mock-data";
import type {
  AIMessage,
  DashboardStats,
  RepoDocument,
  RepositoryDetail,
  RepositorySummary,
  UserProfile,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const getHeaders = (token?: string) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

async function requestJson<T>(path: string, token?: string): Promise<T> {
  if (!API_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
    headers: getHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const frontendFallbacks = {
  repositoryDetail: mockRepositoryDetail,
  user: mockUser,
};

export async function fetchUserProfile(token?: string): Promise<UserProfile> {
  try {
    return await requestJson<UserProfile>("/user/me", token);
  } catch {
    return frontendFallbacks.user;
  }
}

export async function fetchDashboardStats(token?: string): Promise<DashboardStats> {
  try {
    return await requestJson<DashboardStats>("/dashboard/stats", token);
  } catch {
    return { diagrams: 0, docs: 0, questions: 0, repositories: 0 };
  }
}

export async function fetchRepositories(token?: string): Promise<RepositorySummary[]> {
  try {
    return await requestJson<RepositorySummary[]>("/repositories", token);
  } catch {
    return [];
  }
}

export async function fetchDocumentation(token?: string): Promise<RepoDocument[]> {
  try {
    return await requestJson<RepoDocument[]>("/dashboard/documentation", token);
  } catch {
    return [];
  }
}

export async function fetchRecentQuestions(token?: string): Promise<AIMessage[]> {
  try {
    return await requestJson<AIMessage[]>("/dashboard/recent-questions", token);
  } catch {
    return [];
  }
}

export async function fetchRepositoryDetail(
  id: string,
  token?: string,
): Promise<RepositoryDetail> {
  try {
    return await requestJson<RepositoryDetail>(`/repositories/${id}`, token);
  } catch {
    return {
      ...frontendFallbacks.repositoryDetail,
      repository: {
        ...frontendFallbacks.repositoryDetail.repository,
        id: Number(id),
      },
    };
  }
}
