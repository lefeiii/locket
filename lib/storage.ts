"use client";

export const followingStorageKey = "locket.following";
export const storySubscriptionsKey = "locket.storySubscriptions";
export const categorySubscriptionsKey = "locket.categorySubscriptions";

function getList(key: string) {
  if (typeof window === "undefined") {
    return [];
  }

  return JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
}

export function isInList(key: string, value: string) {
  return getList(key).includes(value);
}

export function toggleListValue(key: string, value: string) {
  const list = getList(key);
  const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  window.localStorage.setItem(key, JSON.stringify(next));
  return next.includes(value);
}
