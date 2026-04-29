"use client";

import { PlusIcon } from "@heroicons/react/24/solid";
import {
  getMediaKind,
  MEDIA_INPUT_ACCEPT,
  type MediaKind,
} from "@/app/_lib/media";
import { uploadMedia } from "@/app/_lib/client-upload";
import { MediaPreview } from "@/app/_components/transfer/media-preview";
import {
  buildUploadPath,
  isTouchLikeDevice,
} from "@/app/_components/transfer/utils";
import { useEffect, useRef, useState } from "react";

type TransferUploadPanelProps = {
  onUploaded: () => Promise<void>;
  onUploadSuccess: () => void;
  sourceId: string;
  uploadMode: "form-data" | "vercel-blob-client";
};

export function TransferUploadPanel({
  onUploaded,
  onUploadSuccess,
  sourceId,
  uploadMode,
}: TransferUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const recentImageUrlRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [recentImageUrl, setRecentImageUrl] = useState<string | null>(null);
  const [recentImageName, setRecentImageName] = useState("");
  const [recentMediaType, setRecentMediaType] = useState<MediaKind>("image");

  const uploadRadius = 32;
  const uploadStrokeWidth = 4;
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

  function commitRecentImage(
    previewUrl: string,
    fileName: string,
    mediaType: MediaKind,
  ) {
    setRecentImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      recentImageUrlRef.current = previewUrl;
      return previewUrl;
    });
    setRecentImageName(fileName);
    setRecentMediaType(mediaType);
  }

  function scheduleRecentImage(
    previewUrl: string,
    fileName: string,
    mediaType: MediaKind,
  ) {
    clearPreviewTimer();

    const delay = isTouchLikeDevice() ? 260 : 0;

    if (delay === 0) {
      commitRecentImage(previewUrl, fileName, mediaType);
      return;
    }

    previewTimerRef.current = window.setTimeout(() => {
      commitRecentImage(previewUrl, fileName, mediaType);
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
    setRecentMediaType("image");
    triggerPicker();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || uploading) {
      return;
    }

    if (!sourceId) {
      setUploadStatus("存储源加载中");
      return;
    }

    setUploadStatus("");
    setUploadProgress(0);
    setUploading(true);

    try {
      const mediaType = getMediaKind(file.type, file.name);

      await uploadMedia({
        file,
        sourceId,
        uploadMode,
        pathname: buildUploadPath(file.name, file.type),
        onProgress: setUploadProgress,
      });

      const previewUrl = URL.createObjectURL(file);
      setUploadProgress(100);
      setUploadStatus("传输完成");
      onUploadSuccess();
      scheduleRecentImage(previewUrl, file.name, mediaType);
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
    <section className="w-full max-w-sm">
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_INPUT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={
          recentImageUrl && !uploading ? handleContinueUpload : triggerPicker
        }
        disabled={uploading}
        className="group inline-flex max-w-full items-center gap-3 rounded-[28px] border border-white/18 bg-black/30 p-3 pr-5 text-left shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl transition hover:border-white/36 hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden  bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.20),rgba(255,255,255,0.04)_58%),rgba(0,0,0,0.32)]">
          {!recentImageUrl ? (
            <svg
              className="pointer-events-none absolute -inset-1 -rotate-90 overflow-visible"
              viewBox="0 0 80 80"
              fill="none"
            >
              <circle
                cx="40"
                cy="40"
                r={uploadRadius}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={uploadStrokeWidth}
              />
              <circle
                cx="40"
                cy="40"
                r={uploadRadius}
                stroke="url(#upload-progress-gradient)"
                strokeWidth={uploadStrokeWidth}
                strokeLinecap="round"
                strokeDasharray={uploadCircumference}
                strokeDashoffset={uploadOffset}
                className="transition-all duration-300"
                style={{
                  filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.22))",
                }}
              />
              <defs>
                <linearGradient
                  id="upload-progress-gradient"
                  x1="12"
                  y1="12"
                  x2="68"
                  y2="68"
                >
                  <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                  <stop offset="100%" stopColor="rgba(117,205,255,0.96)" />
                </linearGradient>
              </defs>
            </svg>
          ) : null}

          {recentImageUrl ? (
            <>
              <MediaPreview
                src={recentImageUrl}
                alt={recentImageName || "Uploaded image"}
                mediaType={recentMediaType}
                className="object-cover transition rounded-full duration-500 group-hover:scale-105"
                imageProps={{
                  fill: true,
                  unoptimized: true,
                  sizes: "5rem",
                }}
                showVideoBadge={false}
                videoProps={{
                  autoPlay: true,
                  loop: true,
                }}
              />
              {/* <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.03),rgba(0,0,0,0.34))]" /> */}
            </>
          ) : uploading ? (
            <span className="relative z-10 text-lg font-semibold text-white">
              {uploadProgress}%
            </span>
          ) : (
            <PlusIcon className="relative z-10 size-9 text-white" />
          )}
        </span>

        <span className="min-w-0">
          <span className="block text-base font-semibold text-white">
            上传媒体
          </span>
          <span className="mt-1 block max-w-[13rem] truncate text-sm text-white/62">
            {uploadStatus || (uploading ? "传输中" : "不压缩，不转换")}
          </span>
        </span>
      </button>
    </section>
  );
}
