"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/context/auth-context";

export type RepoNotification = {
  createdAt: string;
  href: string;
  id: string;
  isRead: boolean;
  message: string;
  title: string;
  type: "diagram" | "documentation";
};

type AddNotificationInput = {
  href: string;
  message: string;
  title: string;
  type: RepoNotification["type"];
};

type NotificationContextValue = {
  addNotification: (notification: AddNotificationInput) => void;
  clearNotifications: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  notifications: RepoNotification[];
  unreadCount: number;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);
const STORAGE_KEY = "repoai.notifications";
const MAX_NOTIFICATIONS = 25;

function userNotificationStorageKey(userId: number | string | undefined) {
  return userId ? `${STORAGE_KEY}.${userId}` : null;
}

function loadStoredNotifications(storageKey: null | string) {
  if (typeof window === "undefined") {
    return [];
  }

  if (!storageKey) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as RepoNotification[] : [];
  } catch {
    return [];
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const storageKey = userNotificationStorageKey(user?.id);
  const [activeStorageKey, setActiveStorageKey] = useState(storageKey);
  const [notifications, setNotifications] = useState<RepoNotification[]>(() =>
    loadStoredNotifications(storageKey),
  );

  if (activeStorageKey !== storageKey) {
    setActiveStorageKey(storageKey);
    setNotifications(loadStoredNotifications(storageKey));
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!storageKey) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(notifications));
  }, [notifications, storageKey]);

  const addNotification = useCallback((notification: AddNotificationInput) => {
    if (!storageKey) {
      return;
    }

    const nextNotification: RepoNotification = {
      ...notification,
      createdAt: new Date().toISOString(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      isRead: false,
    };

    setNotifications((current) => [nextNotification, ...current].slice(0, MAX_NOTIFICATIONS));
  }, [storageKey]);

  const markRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true })),
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      addNotification,
      clearNotifications,
      markAllRead,
      markRead,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length,
    }),
    [addNotification, clearNotifications, markAllRead, markRead, notifications],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider.");
  }

  return context;
}
