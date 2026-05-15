"use client";

import {
  ArrowPathIcon,
  LinkIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";

export const DEFAULT_SHARE_UPLOAD_OPTIONS = {
  allowVideo: false,
  expiresInMinutes: 10,
  maxFiles: 10,
};

export type ShareUploadOptions = typeof DEFAULT_SHARE_UPLOAD_OPTIONS;

export type ShareUploadPayload = {
  expiresAt: number;
  maxFiles: number;
  sourceLabel: string;
  token: string;
  url: string;
};

export function ShareUploadDialog({
  draft,
  error,
  loading,
  payload,
  onClose,
  onCopyLink,
  onRegenerate,
  onUpdateDraft,
}: {
  draft: ShareUploadOptions;
  error: string;
  loading: boolean;
  payload: ShareUploadPayload | null;
  onClose: () => void;
  onCopyLink: () => void;
  onRegenerate: () => void;
  onUpdateDraft: (draft: ShareUploadOptions) => void;
}) {
  const expiresAtLabel = payload
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(payload.expiresAt))
    : "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onRegenerate();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="分享上传二维码"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[26px] border border-white/12 bg-[#080b12]/96 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">扫码上传</h2>
            <p className="mt-1 text-sm text-white/52">
              {payload
                ? `${payload.sourceLabel} · 有效至 ${expiresAtLabel} · 最多 ${payload.maxFiles} 张`
                : "正在生成二维码"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/68 transition hover:bg-white/10 hover:text-white"
            aria-label="关闭"
            title="关闭"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex min-h-72 items-center justify-center rounded-3xl border border-white/10 bg-white p-4">
          {payload ? (
            <QRCodeSVG value={payload.url} size={248} marginSize={2} />
          ) : (
            <ArrowPathIcon className="size-7 animate-spin text-slate-950" />
          )}
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-300/18 bg-rose-950/35 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCopyLink}
            disabled={!payload}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/12 bg-white/7 px-3 text-sm font-medium text-white/74 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <LinkIcon className="mr-1.5 size-4" />
            复制链接
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-full bg-white px-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
          >
            <ArrowPathIcon
              className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`}
            />
            重新生成
          </button>
        </div>

        <details className="mt-3 rounded-2xl border border-white/10 bg-white/6 p-3">
          <summary className="cursor-pointer text-sm font-medium text-white/78">
            高级
          </summary>
          <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/48">
                生效时间（分钟）
              </span>
              <input
                type="number"
                min={1}
                max={1440}
                value={draft.expiresInMinutes}
                onChange={(event) =>
                  onUpdateDraft({
                    ...draft,
                    expiresInMinutes: Number(event.target.value),
                  })
                }
                className="h-10 w-full rounded-2xl border border-white/10 bg-black/28 px-3 text-sm font-medium text-white outline-none transition focus:border-cyan-200/48"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/48">
                上传图片限制
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={draft.maxFiles}
                onChange={(event) =>
                  onUpdateDraft({
                    ...draft,
                    maxFiles: Number(event.target.value),
                  })
                }
                className="h-10 w-full rounded-2xl border border-white/10 bg-black/28 px-3 text-sm font-medium text-white outline-none transition focus:border-cyan-200/48"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onUpdateDraft({ ...draft, allowVideo: !draft.allowVideo })
              }
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:bg-white/10"
            >
              <span className="text-sm font-medium text-white/78">
                允许上传视频
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
                  draft.allowVideo
                    ? "border-cyan-100/36 bg-cyan-100/28"
                    : "border-white/12 bg-black/32"
                }`}
                aria-hidden
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white transition ${
                    draft.allowVideo ? "left-6" : "left-1"
                  }`}
                />
              </span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
            >
              应用并重新生成
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}
