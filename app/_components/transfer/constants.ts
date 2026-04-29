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

export const HERO_IMAGE_PLACEHOLDER = ("data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 36">
      <defs>
        <linearGradient id="base" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#18202a" />
          <stop offset="42%" stop-color="#31415a" />
          <stop offset="100%" stop-color="#050505" />
        </linearGradient>
        <linearGradient id="wash" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f766e" stop-opacity="0.52" />
          <stop offset="48%" stop-color="#e2b86b" stop-opacity="0.24" />
          <stop offset="100%" stop-color="#b4536c" stop-opacity="0.34" />
        </linearGradient>
        <filter id="soft">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <rect width="64" height="36" fill="url(#base)" />
      <path d="M-4 30 C14 18 23 12 38 16 C51 20 60 12 70 4 L70 44 L-4 44 Z" fill="url(#wash)" filter="url(#soft)" />
      <path d="M-6 5 C11 10 24 8 39 3 C50 0 59 4 70 11 L70 -4 L-6 -4 Z" fill="#d7e4ef" opacity="0.13" filter="url(#soft)" />
      <rect width="64" height="36" fill="#000" opacity="0.16" />
    </svg>
  `)) as `data:image/${string}`;
