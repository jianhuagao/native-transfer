"use client";

import {
  getMediaKind,
  isAllowedUploadMedia,
  MEDIA_INPUT_ACCEPT,
  type MediaKind,
} from "@/app/_lib/media";
import { uploadMedia } from "@/app/_lib/client-upload";
import { MediaPreview } from "@/app/_components/transfer/media-preview";
import {
  buildThumbnailPath,
  buildUploadPath,
  formatFileSize,
  isTouchLikeDevice,
} from "@/app/_components/transfer/utils";
import { createImageThumbnail } from "@/app/_lib/client-thumbnail";
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  CloudArrowUpIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";

type TransferUploadPanelProps = {
  onQueueVisibilityChange?: (visible: boolean) => void;
  onUploaded: () => Promise<void>;
  sourceId: string;
  sourcePrefix: string;
  uploadMode: "form-data" | "s3-presigned-url" | "vercel-blob-client";
};

type UploadQueueStatus =
  | "queued"
  | "uploading"
  | "thumbnail"
  | "done"
  | "error"
  | "cancelled";

type UploadQueueItem = {
  id: string;
  error?: string;
  file: File;
  mediaType: MediaKind;
  previewUrl: string;
  progress: number;
  status: UploadQueueStatus;
  statusText: string;
};

type ActiveUpload = {
  controller: AbortController;
  id: string;
};

const RECENT_PREVIEW_DELAY_TOUCH_MS = 260;
const DROP_STATE_RESET_MS = 180;

function createQueueId(file: File) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${file.name}-${file.size}-${file.lastModified}-${randomPart}`;
}

function getUploadStatusLabel(status: UploadQueueStatus) {
  if (status === "queued") {
    return "等待中";
  }

  if (status === "uploading") {
    return "上传中";
  }

  if (status === "thumbnail") {
    return "生成缩略图";
  }

  if (status === "done") {
    return "完成";
  }

  if (status === "cancelled") {
    return "已取消";
  }

  return "失败";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}

export function TransferUploadPanel({
  onQueueVisibilityChange,
  onUploaded,
  sourceId,
  sourcePrefix,
  uploadMode,
}: TransferUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const recentImageUrlRef = useRef<string | null>(null);
  const activeUploadRef = useRef<ActiveUpload | null>(null);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const processingRef = useRef(false);
  const refreshAfterQueueRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [recentImageUrl, setRecentImageUrl] = useState<string | null>(null);
  const [recentImageName, setRecentImageName] = useState("");
  const [recentMediaType, setRecentMediaType] = useState<MediaKind>("image");

  const activeItem = queue.find(
    (item) => item.status === "uploading" || item.status === "thumbnail",
  );
  const queuedCount = queue.filter((item) => item.status === "queued").length;
  const failedCount = queue.filter((item) => item.status === "error").length;
  const doneCount = queue.filter((item) => item.status === "done").length;
  const activeProgress = activeItem?.progress ?? (recentImageUrl ? 100 : 0);
  const queueVisible = queue.length > 0;
  const uploadRadius = 32;
  const uploadStrokeWidth = 4;
  const uploadCircumference = 2 * Math.PI * uploadRadius;
  const uploadOffset = uploadCircumference * (1 - activeProgress / 100);

  function updateQueue(updater: (items: UploadQueueItem[]) => UploadQueueItem[]) {
    setQueue((currentItems) => {
      const nextItems = updater(currentItems);
      queueRef.current = nextItems;
      return nextItems;
    });
  }

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
      if (current && current !== previewUrl) {
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

    const delay = isTouchLikeDevice() ? RECENT_PREVIEW_DELAY_TOUCH_MS : 0;

    if (delay === 0) {
      commitRecentImage(previewUrl, fileName, mediaType);
      return;
    }

    previewTimerRef.current = window.setTimeout(() => {
      commitRecentImage(previewUrl, fileName, mediaType);
      previewTimerRef.current = null;
    }, delay);
  }

  function markItem(
    id: string,
    changes:
      | Partial<UploadQueueItem>
      | ((item: UploadQueueItem) => Partial<UploadQueueItem>),
  ) {
    updateQueue((items) =>
      items.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const patch = typeof changes === "function" ? changes(item) : changes;

        return {
          ...item,
          ...patch,
        };
      }),
    );
  }

  function ensureProcessing() {
    if (processingRef.current) {
      return;
    }

    window.setTimeout(() => {
      void processQueue();
    }, 0);
  }

  function enqueueFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    const mediaFiles = selectedFiles.filter((file) =>
      isAllowedUploadMedia(file.type, file.name),
    );

    if (mediaFiles.length === 0) {
      return;
    }

    const nextItems = mediaFiles.map<UploadQueueItem>((file) => ({
      id: createQueueId(file),
      file,
      mediaType: getMediaKind(file.type, file.name),
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      status: "queued",
      statusText: "等待上传",
    }));

    updateQueue((items) => [...items, ...nextItems]);
    ensureProcessing();
  }

  async function uploadQueueItem(item: UploadQueueItem) {
    if (!sourceId) {
      markItem(item.id, {
        error: "存储源加载中，请稍后重试。",
        status: "error",
        statusText: "存储源未就绪",
      });
      return;
    }

    const controller = new AbortController();
    activeUploadRef.current = {
      controller,
      id: item.id,
    };

    try {
      const pathname = buildUploadPath(item.file.name, item.file.type, sourcePrefix);

      markItem(item.id, {
        error: undefined,
        progress: 0,
        status: "uploading",
        statusText: "上传原文件",
      });

      await uploadMedia({
        file: item.file,
        sourceId,
        uploadMode,
        pathname,
        signal: controller.signal,
        onProgress: (percentage) => {
          markItem(item.id, {
            progress: percentage,
            statusText: `上传 ${percentage}%`,
          });
        },
      });

      if (controller.signal.aborted) {
        throw new DOMException("Upload cancelled", "AbortError");
      }

      if (item.mediaType === "image") {
        markItem(item.id, {
          progress: 100,
          status: "thumbnail",
          statusText: "生成缩略图",
        });

        try {
          const thumbnail = await createImageThumbnail(item.file);

          if (thumbnail && !controller.signal.aborted) {
            await uploadMedia({
              file: thumbnail,
              sourceId,
              uploadMode,
              pathname: buildThumbnailPath(pathname, sourcePrefix),
              signal: controller.signal,
              onProgress: () => {
                return;
              },
            });
          }
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }

          // The original file is already stored; missing thumbnails fall back to
          // the protected original preview route.
        }
      }

      if (controller.signal.aborted) {
        throw new DOMException("Upload cancelled", "AbortError");
      }

      markItem(item.id, {
        progress: 100,
        status: "done",
        statusText: "传输完成",
      });
      scheduleRecentImage(item.previewUrl, item.file.name, item.mediaType);
      refreshAfterQueueRef.current = true;
    } catch (error) {
      if (isAbortError(error)) {
        markItem(item.id, {
          error: undefined,
          status: "cancelled",
          statusText: "已取消",
        });
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "上传失败，请检查网络或服务状态。";

      markItem(item.id, {
        error: message || "上传失败，请检查网络或服务状态。",
        status: "error",
        statusText: "上传失败",
      });
    } finally {
      if (activeUploadRef.current?.id === item.id) {
        activeUploadRef.current = null;
      }
    }
  }

  async function processQueue() {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;

    try {
      while (true) {
        const nextItem = queueRef.current.find(
          (item) => item.status === "queued",
        );

        if (!nextItem) {
          break;
        }

        await uploadQueueItem(nextItem);
      }

      if (refreshAfterQueueRef.current) {
        refreshAfterQueueRef.current = false;
        await onUploaded();
      }
    } finally {
      processingRef.current = false;

      if (queueRef.current.some((item) => item.status === "queued")) {
        ensureProcessing();
      }
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;

    if (files) {
      enqueueFiles(files);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    enqueueFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    window.setTimeout(() => setDragging(false), DROP_STATE_RESET_MS);
  }

  function cancelItem(item: UploadQueueItem) {
    if (
      activeUploadRef.current?.id === item.id &&
      (item.status === "uploading" || item.status === "thumbnail")
    ) {
      activeUploadRef.current.controller.abort();
      return;
    }

    if (item.status === "queued") {
      markItem(item.id, {
        status: "cancelled",
        statusText: "已取消",
      });
    }
  }

  function retryItem(item: UploadQueueItem) {
    markItem(item.id, {
      error: undefined,
      progress: 0,
      status: "queued",
      statusText: "等待上传",
    });
    ensureProcessing();
  }

  function clearFinishedItems() {
    updateQueue((items) => {
      const remainingItems: UploadQueueItem[] = [];

      for (const item of items) {
        const removable =
          item.status === "done" ||
          item.status === "cancelled" ||
          item.status === "error";

        if (!removable) {
          remainingItems.push(item);
          continue;
        }

        if (recentImageUrlRef.current !== item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }

      return remainingItems;
    });
  }

  useEffect(() => {
    onQueueVisibilityChange?.(queueVisible);
  }, [onQueueVisibilityChange, queueVisible]);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (isEditableTarget(event.target)) {
        return;
      }

      const files = event.clipboardData?.files;

      if (!files || files.length === 0) {
        return;
      }

      enqueueFiles(files);
    }

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  });

  useEffect(() => {
    return () => {
      clearPreviewTimer();
      activeUploadRef.current?.controller.abort();

      for (const item of queueRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }

      if (recentImageUrlRef.current) {
        URL.revokeObjectURL(recentImageUrlRef.current);
        recentImageUrlRef.current = null;
      }
    };
  }, []);

  return (
    <section
      className="w-full max-w-md"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={MEDIA_INPUT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        className={`rounded-[30px] border p-1.5 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl transition ${
          dragging
            ? "border-cyan-200/58 bg-cyan-200/12"
            : "border-white/18 bg-black/30 hover:border-white/32 hover:bg-white/10"
        }`}
      >
        <button
          type="button"
          onClick={triggerPicker}
          className="group flex w-full items-center gap-3 rounded-[24px] p-1.5 pr-3 text-left transition"
        >
          <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.20),rgba(255,255,255,0.04)_58%),rgba(0,0,0,0.32)]">
            {!recentImageUrl ? (
              <svg
                className="pointer-events-none absolute inset-0 size-full"
                viewBox="0 0 80 80"
                fill="none"
                aria-hidden="true"
              >
                <g transform="rotate(-90 40 40)">
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
                </g>
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
              <MediaPreview
                src={recentImageUrl}
                alt={recentImageName || "Uploaded image"}
                mediaType={recentMediaType}
                className="rounded-full object-cover transition duration-500 group-hover:scale-105"
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
            ) : activeItem ? (
              <span className="relative z-10 text-lg font-semibold text-white">
                {activeProgress}%
              </span>
            ) : (
              <CloudArrowUpIcon className="relative z-10 size-8 text-white" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-white">
              上传媒体
            </span>
            <span className="mt-1 block max-w-60 truncate text-sm text-white/62">
              {activeItem
                ? activeItem.statusText
                : queueVisible
                  ? `${doneCount} 已完成 · ${queuedCount} 等待 · ${failedCount} 失败`
                  : "可多选、拖拽或粘贴上传"}
            </span>
          </span>

          <span className="hidden rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/70 sm:inline-flex">
            <PlusIcon className="mr-1 size-3.5" />
            添加
          </span>
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ${
            queueVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="mt-1 max-h-68 space-y-2 overflow-y-auto px-1 pb-1 pr-1">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-[18px] border border-white/10 bg-black/28 p-2"
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-white/8">
                    <MediaPreview
                      src={item.previewUrl}
                      alt={item.file.name}
                      mediaType={item.mediaType}
                      className="object-cover"
                      imageProps={{
                        fill: true,
                        unoptimized: true,
                        sizes: "2.75rem",
                      }}
                      showVideoBadge={item.mediaType === "video"}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-white/88">
                      {item.file.name}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-white/48">
                      <span>{formatFileSize(item.file.size)}</span>
                      <span>{getUploadStatusLabel(item.status)}</span>
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className={`block h-full rounded-full transition-[width] duration-300 ${
                          item.status === "error"
                            ? "bg-rose-300"
                            : item.status === "done"
                              ? "bg-emerald-200"
                              : item.status === "cancelled"
                                ? "bg-white/28"
                                : "bg-cyan-100"
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </span>
                    {item.error ? (
                      <span className="mt-1 block truncate text-[11px] text-rose-200/90">
                        {item.error}
                      </span>
                    ) : null}
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    {item.status === "done" ? (
                      <CheckIcon className="size-4.5 text-emerald-200" />
                    ) : null}
                    {item.status === "error" || item.status === "cancelled" ? (
                      <button
                        type="button"
                        onClick={() => retryItem(item)}
                        className="flex size-8 items-center justify-center rounded-full text-white/78 transition hover:bg-white/12 hover:text-white"
                        title="重试"
                        aria-label={`重试 ${item.file.name}`}
                      >
                        <ArrowPathIcon className="size-4" />
                      </button>
                    ) : null}
                    {item.status === "queued" ||
                    item.status === "uploading" ||
                    item.status === "thumbnail" ? (
                      <button
                        type="button"
                        onClick={() => cancelItem(item)}
                        className="flex size-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/12 hover:text-white"
                        title="取消"
                        aria-label={`取消 ${item.file.name}`}
                      >
                        <XMarkIcon className="size-4.5" />
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                <ClipboardDocumentIcon className="size-3.5" />
                支持拖拽、粘贴和多选
              </span>
              <button
                type="button"
                onClick={clearFinishedItems}
                className="rounded-full px-2.5 py-1 text-xs font-medium text-white/62 transition hover:bg-white/10 hover:text-white"
              >
                清理完成项
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
