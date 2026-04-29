import type { TabKey } from "@/app/_components/transfer/types";

export const tabs: { key: TabKey; label: string; description: string }[] = [
  { key: "transfer", label: "传输", description: "" },
  { key: "history", label: "内容", description: "" },
];

export const HISTORY_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))",
};

export const IMAGE_PLACEHOLDER = ("data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#182131" />
          <stop offset="50%" stop-color="#22314a" />
          <stop offset="100%" stop-color="#111827" />
        </linearGradient>
        <filter id="b">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <rect width="48" height="48" fill="url(#g)" filter="url(#b)" />
    </svg>
  `)) as `data:image/${string}`;
