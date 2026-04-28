"use client";

import { upload } from "@vercel/blob/client";
import { PlusIcon } from "@heroicons/react/24/solid";
import { ProgressiveImage } from "@/app/_components/transfer/progressive-image";
import {
  buildUploadPath,
  isTouchLikeDevice,
} from "@/app/_components/transfer/utils";
import { useEffect, useRef, useState } from "react";

type TransferUploadPanelProps = {
  onUploaded: () => Promise<void>;
  onUploadSuccess: () => void;
};

export function TransferUploadPanel({
  onUploaded,
  onUploadSuccess,
}: TransferUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const recentImageUrlRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [recentImageUrl, setRecentImageUrl] = useState<string | null>(null);
  const [recentImageName, setRecentImageName] = useState("");

  const uploadRadius = 120;
  const uploadStrokeWidth = 8;
  const uploadCircumference = 2 * Math.PI * uploadRadius;
  const displayedUploadProgress = recentImageUrl ? 100 : uploadProgress;
  const uploadOffset =
    uploadCircumference * (1 - displayedUploadProgress / 100);

  function triggerPicker() {
    inputRef.current?.click();
  }

  function clearPreviewTimer() {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }

  function commitRecentImage(previewUrl: string, fileName: string) {
    setRecentImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      recentImageUrlRef.current = previewUrl;
      return previewUrl;
    });
    setRecentImageName(fileName);
  }

  function scheduleRecentImage(previewUrl: string, fileName: string) {
    clearPreviewTimer();

    const delay = isTouchLikeDevice() ? 260 : 0;

    if (delay === 0) {
      commitRecentImage(previewUrl, fileName);
      return;
    }

    previewTimerRef.current = window.setTimeout(() => {
      commitRecentImage(previewUrl, fileName);
      previewTimerRef.current = null;
    }, delay);
  }

  function handleContinueUpload() {
    clearPreviewTimer();
    setUploadProgress(0);
    setUploadStatus("");
    setRecentImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      recentImageUrlRef.current = null;
      return null;
    });
    setRecentImageName("");
    triggerPicker();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || uploading) {
      return;
    }

    setUploadStatus("");
    setUploadProgress(0);
    setUploading(true);

    try {
      await upload(buildUploadPath(file.name), file, {
        access: "private",
        handleUploadUrl: "/api/images/upload",
        multipart: true,
        contentType: file.type || undefined,
        onUploadProgress: ({ percentage }) => {
          setUploadProgress(Math.round(percentage));
        },
      });

      const previewUrl = URL.createObjectURL(file);
      setUploadProgress(100);
      setUploadStatus("传输完成");
      onUploadSuccess();
      scheduleRecentImage(previewUrl, file.name);
      await onUploaded();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "上传失败，请检查网络或服务状态。";
      setUploadStatus(message || "上传失败，请检查网络或服务状态。");
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    return () => {
      clearPreviewTimer();

      if (recentImageUrlRef.current) {
        URL.revokeObjectURL(recentImageUrlRef.current);
        recentImageUrlRef.current = null;
      }
    };
  }, []);

  return (
    <section className="flex min-h-128 items-center justify-center">
      <article className="w-full max-w-3xl rounded-4xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.13),rgba(255,255,255,0.03))] p-6 sm:p-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">
            上传原图
          </h2>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/45">
            本地保存
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-8 py-4">
          <div className="relative size-76 sm:size-96">
            {!recentImageUrl ? (
              <svg
                className="pointer-events-none absolute inset-0 z-20 -rotate-90 overflow-visible"
                viewBox="0 0 280 280"
                fill="none"
              >
                <circle
                  cx="140"
                  cy="140"
                  r={uploadRadius}
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth={uploadStrokeWidth}
                />
                <circle
                  cx="140"
                  cy="140"
                  r={uploadRadius}
                  stroke="url(#upload-progress-gradient)"
                  strokeWidth={uploadStrokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={uploadCircumference}
                  strokeDashoffset={uploadOffset}
                  className="transition-all duration-300"
                  style={{
                    filter: "drop-shadow(0 0 12px rgba(149, 214, 255, 0.18))",
                  }}
                />
                <defs>
                  <linearGradient
                    id="upload-progress-gradient"
                    x1="20"
                    y1="20"
                    x2="260"
                    y2="260"
                  >
                    <stop offset="0%" stopColor="rgba(149,214,255,0.96)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
                  </linearGradient>
                </defs>
              </svg>
            ) : null}

            <button
              type="button"
              onClick={
                recentImageUrl && !uploading
                  ? handleContinueUpload
                  : triggerPicker
              }
              disabled={uploading}
              className="absolute inset-[1.7rem] z-10 overflow-hidden rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0.02)_58%),rgba(0,0,0,0.28)] transition hover:border-cyan-200/35 hover:bg-black/30 disabled:cursor-not-allowed"
            >
              {recentImageUrl ? (
                <>
                  <ProgressiveImage
                    src={recentImageUrl}
                    alt={recentImageName || "Uploaded image"}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 18rem, 22rem"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.44))]" />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white/55">
                    Original
                  </div>
                  <div className="text-xl font-medium text-white">
                    {uploading ? `${uploadProgress}%` : "选择图片"}
                  </div>
                  <div className="mt-3 text-sm text-white/45">
                    {uploading ? "传输中" : "不压缩，不转换"}
                  </div>
                </div>
              )}
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-sm text-white/46">
              {recentImageUrl ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/18 text-emerald-300">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M4.5 10.5 8 14l7.5-8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              ) : null}
              <span>{uploadStatus || "支持手机和桌面端原图传输"}</span>
            </div>
            {recentImageUrl ? (
              <button
                type="button"
                onClick={handleContinueUpload}
                className="mt-2 rounded-full border border-white/10 bg-white/8 p-2.5 text-sm text-white/82 transition hover:bg-white/12"
              >
                <PlusIcon className="size-5" />
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}
