"use client";

import { LoginScreen } from "@/app/_components/transfer/login-screen";
import { TransferUploadPanel } from "@/app/_components/transfer/transfer-upload-panel";
import {
  DEFAULT_SHARE_UPLOAD_OPTIONS,
  ShareUploadDialog,
  type ShareUploadOptions,
  type ShareUploadPayload,
} from "@/app/_components/transfer/share-upload-dialog";
import type {
  ImagesPayload,
  StorageSource,
  StorageUsage,
  StoredImage,
  TransferAppProps,
} from "@/app/_components/transfer/types";
import {
  buildDeleteImagePath,
  formatFileSize,
  isTouchLikeDevice,
} from "@/app/_components/transfer/utils";
import {
  ArrowDownOnSquareIcon,
  ArrowPathIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  PowerIcon,
  QrCodeIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const ImageViewerModal = dynamic(
  () =>
    import("@/app/_components/transfer/image-viewer-modal").then(
      (module) => module.ImageViewerModal,
    ),
  { ssr: false },
);

const EMPTY_STORAGE_USAGE: StorageUsage = {
  totalBytes: 0,
  usedBytes: 0,
  percent: 0,
};
const DEFAULT_UPLOAD_MODE = "form-data";
const IMAGES_PAGE_SIZE = 60;

function removeImageFromUsage(usage: StorageUsage, image: StoredImage) {
  const usedBytes = Math.max(0, usage.usedBytes - image.size);
  const percent =
    usage.totalBytes > 0
      ? Math.min(100, (usedBytes / usage.totalBytes) * 100)
      : 0;

  return {
    ...usage,
    usedBytes,
    percent,
  };
}

function getPreviewImage(image: StoredImage) {
  if (image.mediaType !== "image" || !image.thumbnailUrl) {
    return image;
  }

  return {
    ...image,
    url: image.thumbnailUrl,
  };
}

function StorageUsageText({ usage }: { usage: StorageUsage }) {
  if (usage.totalBytes <= 0) {
    return <span>{formatFileSize(usage.usedBytes)}</span>;
  }

  return (
    <span>
      {formatFileSize(usage.usedBytes)} / {formatFileSize(usage.totalBytes)}
    </span>
  );
}

function StorageSourceSelect({
  activeSourceId,
  disabled,
  sources,
  onChange,
}: {
  activeSourceId: string;
  disabled: boolean;
  sources: StorageSource[];
  onChange: (sourceId: string) => void;
}) {
  if (sources.length <= 1) {
    return <span className="truncate">{sources[0]?.label ?? "存储源"}</span>;
  }

  return (
    <select
      value={activeSourceId}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-55 sm:max-w-44"
      aria-label="切换源"
    >
      {sources.map((source) => (
        <option key={source.id} value={source.id} className="bg-[#111]">
          {source.label}
        </option>
      ))}
    </select>
  );
}

export function LiteTransferApp(props: TransferAppProps) {
  return <LiteTransferAppContent {...props} />;
}

function LiteTransferAppContent({
  initialAuthorized,
  initialPayload,
}: TransferAppProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [authNotice, setAuthNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [images, setImages] = useState<StoredImage[]>(
    initialPayload?.images ?? [],
  );
  const [sources, setSources] = useState<StorageSource[]>(
    initialPayload?.sources ?? [],
  );
  const [activeSourceId, setActiveSourceId] = useState(
    initialPayload?.activeSourceId ?? "",
  );
  const [storageUsage, setStorageUsage] = useState<StorageUsage>(
    initialPayload?.storageUsage ?? EMPTY_STORAGE_USAGE,
  );
  const [historyLoading, setHistoryLoading] = useState(
    initialAuthorized && !initialPayload,
  );
  const [needsInitialFetch, setNeedsInitialFetch] = useState(!initialPayload);
  const [hasMoreImages, setHasMoreImages] = useState(
    initialPayload?.pagination.hasMore ?? false,
  );
  const [nextImagesCursor, setNextImagesCursor] = useState<string | null>(
    initialPayload?.pagination.nextCursor ?? null,
  );
  const [loadingMoreImages, setLoadingMoreImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareUploadOptions>(
    DEFAULT_SHARE_UPLOAD_OPTIONS,
  );
  const [sharePayload, setSharePayload] = useState<ShareUploadPayload | null>(
    null,
  );
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const activeSource = sources.find((source) => source.id === activeSourceId);
  const previewImages = useMemo(() => images.map(getPreviewImage), [images]);
  const selectedPreviewImage = selectedImage
    ? getPreviewImage(selectedImage)
    : null;

  const applyImagesPayload = useCallback((payload: ImagesPayload) => {
    setSources(payload.sources);
    setActiveSourceId(payload.activeSourceId);
    setImages(payload.images);
    setStorageUsage(payload.storageUsage ?? EMPTY_STORAGE_USAGE);
    setHasMoreImages(payload.pagination.hasMore);
    setNextImagesCursor(payload.pagination.nextCursor);
  }, []);

  const refreshImages = useCallback(async () => {
    const response = await fetch(`/api/images?limit=${IMAGES_PAGE_SIZE}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("refresh failed");
    }

    const payload = (await response.json()) as ImagesPayload;
    startTransition(() => {
      applyImagesPayload(payload);
    });
  }, [applyImagesPayload]);

  async function handleLogin(
    password: string,
    options: { liteMode: boolean },
  ) {
    setAuthNotice("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        return payload.error ?? "登录失败";
      }

      if (!options.liteMode) {
        window.location.assign("/");
        return null;
      }

      setHistoryLoading(true);
      setNeedsInitialFetch(true);
      setAuthorized(true);
      return null;
    } catch {
      return "网络异常，请稍后重试。";
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    setPageError("");
    setAuthorized(false);
    setImages([]);
    setSources([]);
    setActiveSourceId("");
    setStorageUsage(EMPTY_STORAGE_USAGE);
    setHasMoreImages(false);
    setNextImagesCursor(null);
    setNeedsInitialFetch(true);
    setSelectedImage(null);
  }

  useEffect(() => {
    if (!authorized || !needsInitialFetch) {
      return;
    }

    let cancelled = false;

    fetch(`/api/images?limit=${IMAGES_PAGE_SIZE}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("load failed");
        }

        return (await response.json()) as ImagesPayload;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setPageError("");
        applyImagesPayload(payload);
        setNeedsInitialFetch(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setAuthorized(false);
        setAuthNotice("登录状态失效，请重新输入密码。");
        setSelectedImage(null);
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applyImagesPayload, authorized, needsInitialFetch]);

  async function handleStorageSourceChange(sourceId: string) {
    if (sourceId === activeSourceId || switchingSource) {
      return;
    }

    setSwitchingSource(true);
    setHistoryLoading(true);

    try {
      const response = await fetch("/api/storage-source", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sourceId }),
      });

      if (!response.ok) {
        throw new Error("switch failed");
      }

      const payload = (await response.json()) as ImagesPayload;
      startTransition(() => {
        applyImagesPayload(payload);
      });
      setSelectedImage(null);
      setPageError("");
    } catch {
      setPageError("切换存储源失败，请检查配置。");
    } finally {
      setHistoryLoading(false);
      setSwitchingSource(false);
    }
  }

  async function handleRefreshImages() {
    if (refreshingImages) {
      return;
    }

    setRefreshingImages(true);

    try {
      await refreshImages();
      setPageError("");
    } catch {
      setPageError("刷新失败，请稍后重试。");
    } finally {
      setRefreshingImages(false);
    }
  }

  async function handleLoadMoreImages() {
    if (loadingMoreImages || !hasMoreImages || !nextImagesCursor) {
      return;
    }

    setLoadingMoreImages(true);

    try {
      const response = await fetch(
        `/api/images?limit=${IMAGES_PAGE_SIZE}&cursor=${encodeURIComponent(
          nextImagesCursor,
        )}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("load more failed");
      }

      const payload = (await response.json()) as ImagesPayload;
      startTransition(() => {
        setImages((currentImages) => [...currentImages, ...payload.images]);
        setSources(payload.sources);
        setActiveSourceId(payload.activeSourceId);
        setStorageUsage(payload.storageUsage ?? EMPTY_STORAGE_USAGE);
        setHasMoreImages(payload.pagination.hasMore);
        setNextImagesCursor(payload.pagination.nextCursor);
      });
      setPageError("");
    } catch {
      setPageError("加载更多失败，请稍后重试。");
    } finally {
      setLoadingMoreImages(false);
    }
  }

  async function generateShareUploadQr(
    options: ShareUploadOptions = shareDraft,
  ) {
    if (!activeSourceId || shareLoading) {
      return;
    }

    setShareLoading(true);
    setShareError("");

    try {
      const response = await fetch("/api/share-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowVideo: options.allowVideo,
          expiresInMinutes: options.expiresInMinutes,
          maxFiles: options.maxFiles,
          sourceId: activeSourceId,
        }),
      });

      const payload = (await response.json()) as
        | ShareUploadPayload
        | { error?: string };

      if (!response.ok || !("url" in payload)) {
        const errorPayload = payload as { error?: string };
        throw new Error(errorPayload.error || "生成二维码失败");
      }

      setSharePayload(payload);
    } catch (error) {
      setSharePayload(null);
      setShareError(error instanceof Error ? error.message : "生成二维码失败");
    } finally {
      setShareLoading(false);
    }
  }

  function openShareUploadDialog() {
    setShareDraft(DEFAULT_SHARE_UPLOAD_OPTIONS);
    setShareDialogOpen(true);
    void generateShareUploadQr(DEFAULT_SHARE_UPLOAD_OPTIONS);
  }

  async function copyShareUploadLink() {
    if (!sharePayload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sharePayload.url);
    } catch {
      window.prompt("复制链接", sharePayload.url);
    }
  }

  async function handleDelete(image: StoredImage) {
    setDeletingId(image.id);

    try {
      const response = await fetch(buildDeleteImagePath(image), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      setImages((currentImages) =>
        currentImages.filter((currentImage) => {
          return !(
            currentImage.id === image.id &&
            currentImage.sourceId === image.sourceId
          );
        }),
      );
      setStorageUsage((currentUsage) =>
        removeImageFromUsage(currentUsage, image),
      );
      setPageError("");
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
    } catch {
      setPageError("删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  }

  function handleDownload(image: StoredImage) {
    const targetUrl = new URL(image.originalUrl, window.location.origin);

    if (!isTouchLikeDevice()) {
      targetUrl.searchParams.set("download", "1");
    }

    window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
  }

  async function handleCopyLink(image: StoredImage) {
    const absoluteUrl = new URL(
      image.originalUrl,
      window.location.origin,
    ).toString();

    try {
      await navigator.clipboard.writeText(absoluteUrl);
    } catch {
      window.prompt("复制链接", absoluteUrl);
    }
  }

  if (!authorized) {
    return (
      <LoginScreen
        defaultLiteMode
        notice={authNotice}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050505]/94 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <StorageSourceSelect
            activeSourceId={activeSourceId}
            disabled={switchingSource || historyLoading}
            sources={sources}
            onChange={(sourceId) => void handleStorageSourceChange(sourceId)}
          />
          <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white/72 sm:max-w-72">
            <CircleStackIcon className="size-4 shrink-0 text-white/60" />
            <StorageUsageText usage={storageUsage} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={openShareUploadDialog}
              disabled={!activeSourceId || historyLoading}
              aria-label="生成上传二维码"
              title="生成上传二维码"
              className="flex size-9 items-center justify-center rounded-lg text-white/78 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <QrCodeIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => void handleRefreshImages()}
              disabled={refreshingImages}
              aria-label={refreshingImages ? "刷新中" : "刷新"}
              title={refreshingImages ? "刷新中" : "刷新"}
              className="flex size-9 items-center justify-center rounded-lg text-white/78 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <ArrowPathIcon
                className={`size-5 ${refreshingImages ? "animate-spin" : ""}`}
              />
            </button>
            <Link
              href="/"
              prefetch={false}
              className="flex h-9 items-center rounded-lg px-2 text-sm text-white/78 transition hover:bg-white/10 hover:text-white"
            >
              完整版
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="退出登录"
              title="退出登录"
              className="flex size-9 items-center justify-center rounded-lg text-white/78 transition hover:bg-white/10"
            >
              <PowerIcon className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-3 px-3 py-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <TransferUploadPanel
            helperText="多选、拖拽或粘贴上传"
            onUploaded={refreshImages}
            showPreviews={false}
            sourceId={activeSourceId}
            sourcePrefix={activeSource?.prefix ?? "uploads/"}
            uploadMode={activeSource?.uploadMode ?? DEFAULT_UPLOAD_MODE}
            uploadTitle="上传"
          />
        </section>

        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <h1 className="text-sm font-semibold text-white/88">图片列表</h1>
            <span className="text-xs text-white/45">{images.length} 项</span>
          </div>

          {pageError ? (
            <p className="mx-3 mt-3 rounded-lg border border-rose-300/18 bg-rose-950/35 px-3 py-2 text-sm text-rose-100">
              {pageError}
            </p>
          ) : null}

          <div className="divide-y divide-white/8">
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-12 text-sm text-white/55">
                <ArrowPathIcon className="size-4 animate-spin" />
                加载中
              </div>
            ) : images.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-3 py-12 text-sm text-white/45">
                <CloudArrowUpIcon className="size-4" />
                暂无图片
              </div>
            ) : (
              images.map((image) => (
                <div
                  key={`${image.sourceId}:${image.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedImage(image)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedImage(image);
                    }
                  }}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.06] sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white/88">
                      {image.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-white/42">
                      {image.uploadedAtLabel} · {image.sourceLabel}
                    </span>
                  </span>
                  <span className="hidden self-center text-right text-xs text-white/52 sm:block">
                    {formatFileSize(image.size)}
                  </span>
                  <span className="flex items-center gap-1 self-center">
                    <span className="text-xs text-white/45 sm:hidden">
                      {formatFileSize(image.size)}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDownload(image);
                      }}
                      title="下载"
                      aria-label={`下载 ${image.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
                    >
                      <ArrowDownOnSquareIcon className="size-4.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === image.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(image);
                      }}
                      title={deletingId === image.id ? "删除中" : "删除"}
                      aria-label={`删除 ${image.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-rose-100 transition hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      {deletingId === image.id ? (
                        <ArrowPathIcon className="size-4.5 animate-spin" />
                      ) : (
                        <TrashIcon className="size-4.5" />
                      )}
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          {hasMoreImages ? (
            <div className="border-t border-white/10 p-3">
              <button
                type="button"
                onClick={() => void handleLoadMoreImages()}
                disabled={loadingMoreImages}
                className="h-10 w-full rounded-lg border border-white/10 bg-black/22 text-sm text-white/72 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
              >
                {loadingMoreImages ? "加载中..." : "加载更多"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      {selectedPreviewImage ? (
        <ImageViewerModal
          key={selectedPreviewImage.id}
          allowOriginalPreview={false}
          deletingId={deletingId}
          images={previewImages}
          previewQuality={70}
          selectedImage={selectedPreviewImage}
          onClose={() => setSelectedImage(null)}
          onCopyLink={handleCopyLink}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onSelectImage={(image) => {
            const originalImage = images.find(
              (item) =>
                item.id === image.id && item.sourceId === image.sourceId,
            );
            setSelectedImage(originalImage ?? image);
          }}
        />
      ) : null}

      {shareDialogOpen ? (
        <ShareUploadDialog
          draft={shareDraft}
          error={shareError}
          loading={shareLoading}
          payload={sharePayload}
          onClose={() => setShareDialogOpen(false)}
          onCopyLink={() => void copyShareUploadLink()}
          onRegenerate={() => void generateShareUploadQr()}
          onUpdateDraft={setShareDraft}
        />
      ) : null}
    </main>
  );
}
