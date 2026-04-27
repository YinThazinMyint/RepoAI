import axios from "axios";

export const TOKEN_STORAGE_KEY = "repoai.auth.token";

let authToken: null | string = null;

export const setApiAuthToken = (token: null | string) => {
  authToken = token;
};

export const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const storeToken = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  setApiAuthToken(token);
};

export const clearStoredToken = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  setApiAuthToken(null);
};

export const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

axiosInstance.interceptors.request.use((config) => {
  const resolvedToken = authToken ?? getStoredToken();

  if (resolvedToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${resolvedToken}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearStoredToken();
    }

    return Promise.reject(error);
  },
);
