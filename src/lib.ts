import type { Concert } from "./types";

export const monthKey = (date: string) => date.slice(0, 7);

export function formatMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${year}年${month}月`;
}

export function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "未掲載";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function isNew(concert: Concert, now = new Date()) {
  const detected = new Date(concert.firstDetectedAt);
  const age = now.getTime() - detected.getTime();
  return age >= 0 && age <= 40 * 24 * 60 * 60 * 1000;
}

export function safeHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
