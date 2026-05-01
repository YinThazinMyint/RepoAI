"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

function loadStoredNotifications() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  const [notifications, setNotifications] = useState<RepoNotification[]>(loadStoredNotifications);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((notification: AddNotificationInput) => {
    const nextNotification: RepoNotification = {
      ...notification,
      createdAt: new Date().toISOString(),
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      isRead: false,
    };

    setNotifications((current) => [nextNotification, ...current].slice(0, MAX_NOTIFICATIONS));
  }, []);

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
