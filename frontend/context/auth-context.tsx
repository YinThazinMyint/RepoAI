"use client";

import {
  clearStoredToken,
  getStoredToken,
  setApiAuthToken,
  storeToken,
} from "@/lib/api";
import { axiosInstance } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthContextValue = {
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithProvider: (provider: "github" | "google") => void;
  logout: () => void;
  setSessionFromToken: (token: string) => Promise<void>;
  signup: (payload: {
    email: string;
    name: string;
    password: string;
    username: string;
  }) => Promise<void>;
  token: null | string;
  user: null | UserProfile;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const backendBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api")
  .replace(/\/api$/, "");

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<null | string>(() => getStoredToken());
  const [user, setUser] = useState<null | UserProfile>(null);
  const [isReady, setIsReady] = useState(() => !getStoredToken());

  async function loadUser(activeToken: string) {
    try {
      const response = await axiosInstance.get<UserProfile>("/user/me");
      startTransition(() => {
        setToken(activeToken);
        setUser(response.data);
      });
    } catch {
      clearStoredToken();
      startTransition(() => {
        setToken(null);
        setUser(null);
      });
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }

    setApiAuthToken(token);
    void loadUser(token).finally(() => setIsReady(true));
  }, [token]);

  const setSessionFromToken = async (nextToken: string) => {
    storeToken(nextToken);
    await loadUser(nextToken);
    setIsReady(true);
  };

  const login = async (email: string, password: string) => {
    const response = await axiosInstance.post<{ token: string; user: UserProfile }>(
      "/auth/login",
      { email, password },
    );
    await setSessionFromToken(response.data.token);
  };

  const signup = async (payload: {
    email: string;
    name: string;
    password: string;
    username: string;
  }) => {
    const response = await axiosInstance.post<{ token: string; user: UserProfile }>(
      "/auth/signup",
      payload,
    );
    await setSessionFromToken(response.data.token);
  };

  const loginWithProvider = (provider: "github" | "google") => {
    window.location.href = `${backendBaseUrl}/oauth2/authorization/${provider}`;
  };

  const logout = () => {
    clearStoredToken();
    startTransition(() => {
      setToken(null);
      setUser(null);
    });
    window.location.href = "/login";
  };

  const value: AuthContextValue = {
    isAuthenticated: Boolean(token),
    isReady,
    login,
    loginWithProvider,
    logout,
    setSessionFromToken,
    signup,
    token,
    user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
};
