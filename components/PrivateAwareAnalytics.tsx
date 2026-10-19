"use client";
import { Analytics } from "@vercel/analytics/next";
export function PrivateAwareAnalytics() {
  return <Analytics beforeSend={event => {
    // Never send pilot, moderator, invitation or conversation URLs to analytics.
    try { return new URL(event.url).pathname.startsWith("/someone-like-me") ? null : event; }
    catch { return null; }
  }} />;
}
