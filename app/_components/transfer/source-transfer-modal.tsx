"use client";

import { MediaPreview } from "@/app/_components/transfer/media-preview";
import type {
  ImagesPayload,
  StorageSource,
  StoredImage,
} from "@/app/_components/transfer/types";
import { formatFileSize } from "@/app/_components/transfer/utils";
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { useEffect, useMemo, useState } from "react";

type ConflictStrategy = "skip" | "rename" | "overwrite";
type TransferResultStatus = "copied" | "failed" | "skipped";
type TransferResult = {
  id: string;
  message?: string;
  name: string;
  sourcePathname: string;
  status: TransferResultStatus;
  targetPathname?: string;
  thumbnail?: "copied" | "missing" | "skipped" | "failed";
};
type TransferPayload = {
  results: TransferResult[];
  summary: {
    copied: number;
    failed: number;
    skipped: number;
    total: number;
  };
};
type MediaFilter = "all" | "image" | "video";
type TransferErrorPayload = {
  error?: string;
};

type SourceTransferModalProps = {
  activeSourceId: string;
  images: StoredImage[];
  onClose: () => void;
  onTransferred: () => Promise<void>;
  sources: StorageSource[];
};

const PAGE_SIZE = 120;

function getImageKey(image: StoredImage) {
  return image.id;
}

function getResultLabel(status: TransferResultStatus) {
  if (status === "copied") {
    return "成功";
  }

  if (status === "skipped") {
    return "跳过";
  }

  return "失败";
}

function getResultClassName(status: TransferResultStatus) {
  if (status === "copied") {
    return "text-emerald-200";
  }

  if (status === "skipped") {
    return "text-amber-100";
  }

  return "text-rose-200";
}

export function SourceTransferModal({
  activeSourceId,
  images,
  onClose,
  onTransferred,
  sources,
}: SourceTransferModalProps) {
  const [fromSourceId, setFromSourceId] = useState(activeSourceId);
  const [toSourceId, setToSourceId] = useState(
    sources.find((source) => source.id !== activeSourceId)?.id ?? "",
  );
  const [sourceImages, setSourceImages] = useState<StoredImage[]>(images);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [conflictStrategy, setConflictStrategy] =
    useState<ConflictStrategy>("skip");
  const [deleteSourceAfterCopy, setDeleteSourceAfterCopy] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState("");
  const [resultPayload, setResultPayload] = useState<TransferPayload | null>(
    null,
  );

  const fromSource = sources.find((source) => source.id === fromSourceId);
  const toSource = sources.find((source) => source.id === toSourceId);
  const filteredImages = useMemo(() => {
    if (filter === "all") {
      return sourceImages;
    }

    return sourceImages.filter((image) => image.mediaType === filter);
  }, [filter, sourceImages]);
  const selectedImages = sourceImages.filter((image) =>
    selectedIds.has(getImageKey(image)),
  );
  const selectedSize = selectedImages.reduce(
    (total, image) => total + image.size,
    0,
  );
  const canTransfer =
    selectedIds.size > 0 &&
    fromSourceId !== toSourceId &&
    Boolean(toSourceId) &&
    !transferring;

  async function loadImages(sourceId: string, options: { append?: boolean } = {}) {
    if (options.append) {
      setLoadingMore(true);
    } else {
      setLoadingImages(true);
    }

    try {
      const cursorQuery =
        options.append && nextCursor
          ? `&cursor=${encodeURIComponent(nextCursor)}`
          : "";
      const response = await fetch(
        `/api/images?source=${encodeURIComponent(
          sourceId,
        )}&limit=${PAGE_SIZE}${cursorQuery}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("加载来源媒体失败");
      }

      const payload = (await response.json()) as ImagesPayload;

      setSourceImages((currentImages) =>
        options.append
          ? [
              ...currentImages,
              ...payload.images.filter(
                (image) =>
                  !currentImages.some(
                    (currentImage) => currentImage.id === image.id,
                  ),
              ),
            ]
          : payload.images,
      );
      setNextCursor(payload.pagination.nextCursor);
      setHasMore(payload.pagination.hasMore);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "加载来源媒体失败",
      );
    } finally {
      setLoadingImages(false);
      setLoadingMore(false);
    }
  }

  function toggleImage(image: StoredImage) {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      const imageKey = getImageKey(image);

      if (nextIds.has(imageKey)) {
        nextIds.delete(imageKey);
      } else {
        nextIds.add(imageKey);
      }

      return nextIds;
    });
  }

  function selectVisibleImages() {
    setSelectedIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const image of filteredImages) {
        nextIds.add(getImageKey(image));
      }

      return nextIds;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function resetTransferState() {
    setSelectedIds(new Set());
    setResultPayload(null);
    setError("");
  }

  function handleFromSourceChange(sourceId: string) {
    resetTransferState();
    setFromSourceId(sourceId);

    if (toSourceId === sourceId) {
      setToSourceId(
        sources.find((source) => source.id !== sourceId)?.id ?? "",
      );
    }

    if (sourceId === activeSourceId) {
      setSourceImages(images);
      setNextCursor(null);
      setHasMore(false);
      return;
    }

    void loadImages(sourceId);
  }

  async function handleTransfer() {
    if (!canTransfer) {
      return;
    }

    setTransferring(true);
    setError("");
    setResultPayload(null);

    try {
      const response = await fetch("/api/images/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conflictStrategy,
          deleteSourceAfterCopy,
          fromSourceId,
          ids: Array.from(selectedIds),
          toSourceId,
        }),
      });

      const payload = (await response.json()) as
        | TransferPayload
        | TransferErrorPayload;

      if (!response.ok) {
        throw new Error((payload as TransferErrorPayload).error || "迁移失败");
      }

      const transferPayload = payload as TransferPayload;

      setResultPayload(transferPayload);
      setSelectedIds(new Set());

      if (deleteSourceAfterCopy) {
        const copiedIds = new Set(
          transferPayload.results
            .filter((result) => result.status === "copied")
            .map((result) => result.id),
        );

        setSourceImages((currentImages) =>
          currentImages.filter((image) => !copiedIds.has(image.id)),
        );
      }

      await onTransferred();
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : "迁移失败",
      );
    } finally {
      setTransferring(false);
    }
  }

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/74 p-3 backdrop-blur-xl sm:p-5"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="迁移媒体"
        className="flex h-[min(92dvh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-white/12 bg-[#070a10]/96 shadow-[0_30px_120px_rgba(0,0,0,0.68)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">迁移媒体</h2>
            <p className="mt-1 text-sm text-white/54">
              默认只复制到目标源，确认成功后再按需删除来源文件。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/72 transition hover:bg-white/10 hover:text-white"
            aria-label="关闭迁移媒体"
            title="关闭"
          >
            <XMarkIcon className="size-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/48">
                  来源
                </span>
                <span className="relative block">
                  <select
                    value={fromSourceId}
                    disabled={transferring}
                    onChange={(event) =>
                      handleFromSourceChange(event.target.value)
                    }
                    className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/8 px-3 pr-9 text-sm font-medium text-white outline-none transition focus:border-cyan-200/48 disabled:opacity-60"
                  >
                    {sources.map((source) => (
                      <option
                        key={source.id}
                        value={source.id}
                        className="bg-[#111]"
                      >
                        {source.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/54" />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-white/48">
                  目标
                </span>
                <span className="relative block">
                  <select
                    value={toSourceId}
                    disabled={transferring}
                    onChange={(event) => setToSourceId(event.target.value)}
                    className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-white/8 px-3 pr-9 text-sm font-medium text-white outline-none transition focus:border-cyan-200/48 disabled:opacity-60"
                  >
                    {sources
                      .filter((source) => source.id !== fromSourceId)
                      .map((source) => (
                        <option
                          key={source.id}
                          value={source.id}
                          className="bg-[#111]"
                        >
                          {source.label}
                        </option>
                      ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/54" />
                </span>
              </label>

              <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-xs text-white/58">
                <div className="flex justify-between gap-3">
                  <span>来源前缀</span>
                  <span className="truncate text-white/78">
                    {fromSource?.prefix ?? "-"}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span>目标前缀</span>
                  <span className="truncate text-white/78">
                    {toSource?.prefix ?? "-"}
                  </span>
                </div>
              </div>

              <fieldset>
                <legend className="mb-2 text-xs font-medium text-white/48">
                  同名文件
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/24 p-1">
                  {[
                    ["skip", "跳过"],
                    ["rename", "重命名"],
                    ["overwrite", "覆盖"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={transferring}
                      onClick={() =>
                        setConflictStrategy(value as ConflictStrategy)
                      }
                      className={`rounded-xl px-2 py-2 text-xs font-medium transition disabled:opacity-60 ${
                        conflictStrategy === value
                          ? "bg-white text-slate-950"
                          : "text-white/58 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-3 rounded-2xl border border-amber-200/12 bg-amber-200/7 p-3 text-sm text-white/72">
                <input
                  type="checkbox"
                  checked={deleteSourceAfterCopy}
                  disabled={transferring}
                  onChange={(event) =>
                    setDeleteSourceAfterCopy(event.target.checked)
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-amber-50">
                    复制成功后删除来源
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/48">
                    仅成功写入目标源的文件会删除来源，默认建议关闭。
                  </span>
                </span>
              </label>

              <div className="rounded-2xl border border-white/10 bg-black/24 p-3">
                <div className="text-xs text-white/48">已选择</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {selectedIds.size} 个
                </div>
                <div className="mt-1 text-xs text-white/54">
                  预计 {formatFileSize(selectedSize)}
                </div>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-300/16 bg-rose-950/28 p-3 text-sm text-rose-100">
                  {error}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="flex min-h-0 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/24 p-1">
                {[
                  ["all", "全部"],
                  ["image", "图片"],
                  ["video", "视频"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value as MediaFilter)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      filter === value
                        ? "bg-white text-slate-950"
                        : "text-white/58 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadImages(fromSourceId)}
                  disabled={loadingImages || transferring}
                  className="rounded-full px-3 py-2 text-xs font-medium text-white/68 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  刷新来源
                </button>
                <button
                  type="button"
                  onClick={selectVisibleImages}
                  disabled={filteredImages.length === 0 || transferring}
                  className="rounded-full px-3 py-2 text-xs font-medium text-white/68 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  全选当前
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={selectedIds.size === 0 || transferring}
                  className="rounded-full px-3 py-2 text-xs font-medium text-white/68 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {loadingImages ? (
                <div className="flex h-full min-h-64 items-center justify-center text-sm text-white/52">
                  <ArrowPathIcon className="mr-2 size-4 animate-spin" />
                  加载来源媒体
                </div>
              ) : filteredImages.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {filteredImages.map((image) => {
                      const selected = selectedIds.has(getImageKey(image));

                      return (
                        <button
                          key={`${image.sourceId}:${image.id}`}
                          type="button"
                          disabled={transferring}
                          onClick={() => toggleImage(image)}
                          className={`group relative aspect-[1.58] overflow-hidden rounded-[18px] border bg-black/28 text-left transition hover:border-white/36 disabled:cursor-not-allowed disabled:opacity-70 ${
                            selected
                              ? "border-cyan-100/74 ring-2 ring-cyan-100/24"
                              : "border-white/10"
                          }`}
                        >
                          {image.mediaType === "image" ? (
                            <MediaPreview
                              src={image.thumbnailUrl ?? image.url}
                              alt={image.name}
                              mediaType={image.mediaType}
                              className="object-cover transition duration-500 group-hover:scale-105"
                              imageProps={{
                                fill: true,
                                sizes:
                                  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
                                quality: 70,
                              }}
                            />
                          ) : (
                            <MediaPreview
                              src={image.thumbnailUrl ?? image.url}
                              alt={image.name}
                              mediaType={image.mediaType}
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          )}
                          <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.50))]" />
                          <span
                            className={`absolute left-2 top-2 flex size-6 items-center justify-center rounded-full border text-xs transition ${
                              selected
                                ? "border-cyan-100/70 bg-cyan-100 text-slate-950"
                                : "border-white/22 bg-black/42 text-white/0"
                            }`}
                          >
                            {selected ? <CheckIcon className="size-4" /> : null}
                          </span>
                          <span className="absolute inset-x-2 bottom-2 truncate text-xs font-medium text-white/82">
                            {image.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {hasMore ? (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => void loadImages(fromSourceId, { append: true })}
                        disabled={loadingMore || transferring}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-black/24 px-4 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        {loadingMore ? (
                          <ArrowPathIcon className="size-4 animate-spin" />
                        ) : null}
                        {loadingMore ? "加载中" : "加载更多"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/5 px-6 text-center text-sm text-white/52">
                  暂无可迁移媒体
                </div>
              )}

              {resultPayload ? (
                <div className="mt-4 rounded-3xl border border-white/10 bg-black/24 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-white">
                      迁移结果
                    </div>
                    <div className="text-xs text-white/52">
                      成功 {resultPayload.summary.copied} · 跳过{" "}
                      {resultPayload.summary.skipped} · 失败{" "}
                      {resultPayload.summary.failed}
                    </div>
                  </div>
                  <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
                    {resultPayload.results.map((result) => (
                      <div
                        key={`${result.id}:${result.targetPathname ?? result.status}`}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate text-white/70">
                          {result.name}
                        </span>
                        <span
                          className={`shrink-0 font-medium ${getResultClassName(
                            result.status,
                          )}`}
                        >
                          {getResultLabel(result.status)}
                        </span>
                        {result.message ? (
                          <span className="hidden max-w-52 truncate text-white/40 sm:inline">
                            {result.message}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-2 text-xs leading-relaxed text-white/48">
            <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-100/76" />
            <span>
              {deleteSourceAfterCopy
                ? "当前会在复制成功后删除来源文件，请确认目标源可正常访问。"
                : "当前只复制，不会删除来源文件。"}
            </span>
          </div>
          <button
            type="button"
            disabled={!canTransfer}
            onClick={() => void handleTransfer()}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${
              deleteSourceAfterCopy
                ? "bg-amber-100 text-slate-950 hover:brightness-105"
                : "bg-white text-slate-950 hover:brightness-105"
            }`}
          >
            {transferring ? <ArrowPathIcon className="size-4 animate-spin" /> : null}
            {transferring
              ? "迁移中"
              : deleteSourceAfterCopy
                ? `复制并删除来源文件`
                : `复制到 ${toSource?.label ?? "目标源"}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
