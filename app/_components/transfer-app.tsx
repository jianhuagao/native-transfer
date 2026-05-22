"use client";

import { LoginScreen } from "@/app/_components/transfer/login-screen";
import { TransferUploadPanel } from "@/app/_components/transfer/transfer-upload-panel";
import { HERO_IMAGE_PLACEHOLDER } from "@/app/_components/transfer/constants";
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
import { MediaPreview } from "@/app/_components/transfer/media-preview";
import {
  ArrowDownOnSquareIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CheckIcon,
  ChevronDoubleDownIcon,
  CircleStackIcon,
  DevicePhoneMobileIcon,
  LinkIcon,
  PowerIcon,
  QrCodeIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import dynamic from "next/dynamic";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const ImageViewerModal = dynamic(
  () =>
    import("@/app/_components/transfer/image-viewer-modal").then(
      (module) => module.ImageViewerModal,
    ),
  { ssr: false },
);

const SourceTransferModal = dynamic(
  () =>
    import("@/app/_components/transfer/source-transfer-modal").then(
      (module) => module.SourceTransferModal,
    ),
  { ssr: false },
);

const EMPTY_STORAGE_USAGE: StorageUsage = {
  totalBytes: 0,
  usedBytes: 0,
  percent: 0,
};
const DEFAULT_UPLOAD_MODE = "form-data";
const HERO_TRANSITION_MS = 600;
const HERO_PREVIOUS_RETENTION_MS = 1900;
const IMAGES_PAGE_SIZE = 60;
const MEDIA_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 13rem), 1fr))",
};
const MEDIA_TILE_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 960px) 33vw, (max-width: 1280px) 25vw, (max-width: 1680px) 20vw, 16vw";
const MEDIA_TILE_PRELOAD_MARGIN = "0px 0px 160px 0px";
const QUICK_ACTION_PRESS_MS = 420;
const QUICK_DELETE_CONFIRM_MS = 2400;
const COPY_FEEDBACK_MS = 1400;
const DEFAULT_PAGE_TITLE = "Native Transfer";
const HERO_BACKDROP_STORAGE_KEY = "native-transfer:hero-backdrop";
const DEFAULT_SHARE_UPLOAD_OPTIONS = {
  allowVideo: false,
  expiresInMinutes: 10,
  maxFiles: 10,
};
const PAGE_TITLE_CLASS =
  "text-4xl font-semibold leading-none text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:text-6xl lg:text-7xl";

type HeroBackdropState = {
  current: StoredImage | null;
  previous: StoredImage | null;
  ready: boolean;
  version: number;
};

type ShareUploadOptions = typeof DEFAULT_SHARE_UPLOAD_OPTIONS;

type ShareUploadPayload = {
  expiresAt: number;
  maxFiles: number;
  sourceLabel: string;
  token: string;
  url: string;
};

function pickLatestHeroImage(images: StoredImage[]) {
  return images.find((image) => image.mediaType === "image") ?? null;
}

function getImageIdentity(image: StoredImage | null) {
  return image ? `${image.sourceId}:${image.id}` : "";
}

function readStoredHeroIdentity() {
  try {
    return window.localStorage.getItem(HERO_BACKDROP_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredHeroIdentity(image: StoredImage | null) {
  try {
    if (image) {
      window.localStorage.setItem(
        HERO_BACKDROP_STORAGE_KEY,
        getImageIdentity(image),
      );
      return;
    }

    window.localStorage.removeItem(HERO_BACKDROP_STORAGE_KEY);
  } catch {
    // Ignore browsers or modes where localStorage is unavailable.
  }
}

function pickStoredHeroImage(images: StoredImage[]) {
  const storedIdentity = readStoredHeroIdentity();

  if (!storedIdentity) {
    return null;
  }

  return (
    images.find((image) => {
      return (
        image.mediaType === "image" &&
        getImageIdentity(image) === storedIdentity
      );
    }) ?? null
  );
}

function pickPreferredHeroImage(images: StoredImage[]) {
  return pickStoredHeroImage(images) ?? pickLatestHeroImage(images);
}

function getStoredImageKey(image: StoredImage) {
  return `${image.sourceId}:${image.id}`;
}

function isSameImage(left: StoredImage | null, right: StoredImage | null) {
  return getImageIdentity(left) === getImageIdentity(right);
}

function formatStoragePercent(percent: number, usedBytes: number) {
  if (usedBytes > 0 && percent > 0 && percent < 1) {
    return "<1%";
  }

  return `${Math.round(percent)}%`;
}

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

function StorageUsageBadge({ usage }: { usage: StorageUsage }) {
  const hasQuota = usage.totalBytes > 0;
  const progressPercent = hasQuota ? Math.min(100, usage.percent) : 0;

  return (
    <div
      className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 text-white/78 sm:flex-none"
      title={
        hasQuota
          ? `已用 ${formatStoragePercent(usage.percent, usage.usedBytes)}`
          : `已用 ${formatFileSize(usage.usedBytes)}`
      }
    >
      <CircleStackIcon className="size-4.5 shrink-0 text-cyan-100/86" />
      <div className="min-w-0 flex-1 sm:min-w-29">
        <div className="flex items-center justify-between gap-2 text-xs leading-none">
          <span className="hidden text-white/58 sm:inline">容量</span>
          <span className="truncate font-medium text-white">
            {hasQuota
              ? `${formatFileSize(usage.usedBytes)} / ${formatFileSize(
                  usage.totalBytes,
                )}`
              : formatFileSize(usage.usedBytes)}
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/12">
          <div
            className="h-full rounded-full bg-cyan-100 transition-[width] duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
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
    return null;
  }

  return (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 text-white/78 sm:flex-none">
      <span className="hidden text-xs text-white/48 sm:inline">源</span>
      <select
        value={activeSourceId}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 max-w-full bg-transparent text-sm font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-55 sm:max-w-36"
      >
        {sources.map((source) => (
          <option key={source.id} value={source.id} className="bg-[#111]">
            {source.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ShareUploadDialog({
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

function useInViewOnce<TElement extends Element>(
  rootMargin = MEDIA_TILE_PRELOAD_MARGIN,
) {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const elementRef = useCallback(
    (element: TElement | null) => {
      observerRef.current?.disconnect();

      if (!element || inView) {
        return;
      }

      if (!("IntersectionObserver" in window)) {
        setInView(true);
        return;
      }

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) {
            return;
          }

          setInView(true);
          observerRef.current?.disconnect();
        },
        { rootMargin, threshold: 0.01 },
      );
      observerRef.current.observe(element);
    },
    [inView, rootMargin],
  );

  return { elementRef, inView };
}

const MediaTile = memo(function MediaTile({
  active,
  copied,
  deleteConfirming,
  deleting,
  image,
  onActivateActions,
  onClearActions,
  onCopyImage,
  onDeleteImage,
  onDownloadImage,
  onOpenImage,
}: {
  active: boolean;
  copied: boolean;
  deleteConfirming: boolean;
  deleting: boolean;
  image: StoredImage;
  onActivateActions: (image: StoredImage) => void;
  onClearActions: () => void;
  onCopyImage: (image: StoredImage) => void;
  onDeleteImage: (image: StoredImage) => void;
  onDownloadImage: (image: StoredImage) => void;
  onOpenImage: (image: StoredImage) => void;
}) {
  const { elementRef, inView } = useInViewOnce<HTMLDivElement>();
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onActivateActions(image);
      longPressTimerRef.current = null;

      if ("vibrate" in navigator) {
        navigator.vibrate(8);
      }
    }, QUICK_ACTION_PRESS_MS);
  }

  function runQuickAction(
    event: React.MouseEvent<HTMLButtonElement>,
    action: (image: StoredImage) => void,
  ) {
    event.preventDefault();
    event.stopPropagation();
    clearLongPressTimer();
    action(image);
  }

  useEffect(() => clearLongPressTimer, []);

  return (
    <div
      ref={elementRef}
      className={`group relative aspect-[1.58] select-none overflow-hidden rounded-[22px] border bg-black/30 text-left shadow-[0_16px_42px_rgba(0,0,0,0.32)] [-webkit-touch-callout:none] [-webkit-user-select:none] touch-manipulation transition duration-300 hover:-translate-y-1 ${
        active
          ? "border-cyan-100/74 ring-2 ring-cyan-100/24"
          : "border-white/12 hover:border-white/42"
      }`}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_50%,rgba(0,0,0,0.18))]" />
      <button
        type="button"
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            longPressTriggeredRef.current = false;
            return;
          }

          onClearActions();
          onOpenImage(image);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
        onContextMenu={(event) => {
          if (isTouchLikeDevice()) {
            event.preventDefault();
            onActivateActions(image);
          }
        }}
        aria-label={`打开 ${image.name}`}
        className="absolute inset-0 select-none focus-visible:outline focus-visible:outline-white/70"
      >
        {inView ? (
          image.mediaType === "image" ? (
            <Image
              src={image.thumbnailUrl ?? image.url}
              alt={image.name}
              fill
              loading="lazy"
              sizes={MEDIA_TILE_IMAGE_SIZES}
              quality={70}
              decoding="async"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <MediaPreview
              src={image.thumbnailUrl ?? image.url}
              alt={image.name}
              mediaType={image.mediaType}
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          )
        ) : null}
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.36))]" />
      </button>

      <div
        className={`absolute inset-x-2 top-2 flex items-center justify-start gap-1 transition duration-200 ${
          active
            ? "opacity-100"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        }`}
      >
        <button
          type="button"
          onClick={(event) => runQuickAction(event, onCopyImage)}
          title={copied ? "已复制" : "复制链接"}
          aria-label={`${copied ? "已复制" : "复制链接"} ${image.name}`}
          className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/46 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16"
        >
          {copied ? (
            <CheckIcon className="size-4 text-emerald-200" />
          ) : (
            <LinkIcon className="size-4" />
          )}
        </button>
        <button
          type="button"
          onClick={(event) => runQuickAction(event, onDownloadImage)}
          title="下载原图"
          aria-label={`下载 ${image.name}`}
          className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/46 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16"
        >
          <ArrowDownOnSquareIcon className="size-4" />
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={(event) => runQuickAction(event, onDeleteImage)}
          title={deleteConfirming ? "再次点击确认删除" : "删除"}
          aria-label={`${deleteConfirming ? "确认删除" : "删除"} ${image.name}`}
          className={`flex h-8 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
            deleteConfirming
              ? "w-14 border-rose-200/28 bg-rose-400/24 px-2 text-xs font-medium text-rose-50"
              : "w-8 border-white/12 bg-black/46 text-rose-100 hover:bg-rose-400/18"
          }`}
        >
          {deleting ? (
            <ArrowPathIcon className="size-4 animate-spin" />
          ) : deleteConfirming ? (
            "确认"
          ) : (
            <TrashIcon className="size-4" />
          )}
        </button>
      </div>

      {active ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full border border-white/10 bg-black/42 px-3 py-1.5 text-xs font-medium text-white/72 backdrop-blur-md sm:hidden">
          已选择，可复制、下载或删除
        </div>
      ) : null}
    </div>
  );
});

function MediaSkeletonGrid({ count }: { count: number }) {
  return (
    <div data-media-grid className="grid gap-4" style={MEDIA_GRID_STYLE}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="aspect-[1.58] animate-pulse rounded-[22px] border border-white/8 bg-white/10"
        />
      ))}
    </div>
  );
}

const MediaShelf = memo(function MediaShelf({
  deletingId,
  hasMore,
  historyLoading,
  images,
  loadingMore,
  onCopyImage,
  onDeleteImage,
  onDownloadImage,
  onLoadMore,
  onOpenImage,
}: {
  deletingId: string | null;
  hasMore: boolean;
  historyLoading: boolean;
  images: StoredImage[];
  loadingMore: boolean;
  onCopyImage: (image: StoredImage) => Promise<void>;
  onDeleteImage: (image: StoredImage) => Promise<void>;
  onDownloadImage: (image: StoredImage) => void;
  onLoadMore: () => void;
  onOpenImage: (image: StoredImage) => void;
}) {
  const [activeQuickActionKey, setActiveQuickActionKey] = useState("");
  const [copiedImageKey, setCopiedImageKey] = useState("");
  const [deleteConfirmKey, setDeleteConfirmKey] = useState("");
  const [initialTopOffset, setInitialTopOffset] = useState(0);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const measuredInitialOffsetRef = useRef(false);
  const copiedTimerRef = useRef<number | null>(null);
  const deleteConfirmTimerRef = useRef<number | null>(null);

  function clearCopiedTimer() {
    if (copiedTimerRef.current === null) {
      return;
    }

    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = null;
  }

  function clearDeleteConfirmTimer() {
    if (deleteConfirmTimerRef.current === null) {
      return;
    }

    window.clearTimeout(deleteConfirmTimerRef.current);
    deleteConfirmTimerRef.current = null;
  }

  async function handleQuickCopy(image: StoredImage) {
    const imageKey = getStoredImageKey(image);

    await onCopyImage(image);
    clearCopiedTimer();
    setCopiedImageKey(imageKey);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedImageKey("");
      copiedTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  async function handleQuickDelete(image: StoredImage) {
    const imageKey = getStoredImageKey(image);

    if (deleteConfirmKey !== imageKey) {
      clearDeleteConfirmTimer();
      setDeleteConfirmKey(imageKey);
      setActiveQuickActionKey(imageKey);
      deleteConfirmTimerRef.current = window.setTimeout(() => {
        setDeleteConfirmKey("");
        deleteConfirmTimerRef.current = null;
      }, QUICK_DELETE_CONFIRM_MS);
      return;
    }

    clearDeleteConfirmTimer();
    setDeleteConfirmKey("");
    await onDeleteImage(image);
    setActiveQuickActionKey("");
  }

  function handleActivateActions(image: StoredImage) {
    setActiveQuickActionKey(getStoredImageKey(image));
  }

  function handleClearActions() {
    setActiveQuickActionKey("");
    setDeleteConfirmKey("");
    clearDeleteConfirmTimer();
  }

  useEffect(() => {
    return () => {
      clearCopiedTimer();
      clearDeleteConfirmTimer();
    };
  }, []);

  useLayoutEffect(() => {
    if (measuredInitialOffsetRef.current) {
      return;
    }

    const dock = dockRef.current;

    if (!dock || !window.matchMedia("(min-width: 40rem)").matches) {
      measuredInitialOffsetRef.current = true;
      return;
    }

    const grid = dock.querySelector<HTMLElement>("[data-media-grid]");
    const firstItem = grid?.firstElementChild as HTMLElement | null;

    if (!grid || !firstItem) {
      return;
    }

    const dockStyle = window.getComputedStyle(dock);
    const gridStyle = window.getComputedStyle(grid);
    const borderTopWidth = parseFloat(dockStyle.borderTopWidth) || 0;
    const paddingTop = parseFloat(dockStyle.paddingTop) || 0;
    const rowGap = parseFloat(gridStyle.rowGap) || 0;
    const offset =
      borderTopWidth + paddingTop + firstItem.offsetHeight + rowGap - 1;

    setInitialTopOffset(-Math.max(0, offset));
    measuredInitialOffsetRef.current = true;
  }, [historyLoading, images.length]);

  return (
    <section className="relative z-50 -mt-14 px-3 pb-14 sm:z-30 sm:mt-0 sm:px-6 sm:pb-20 lg:px-10">
      <div
        className="relative z-10 mx-auto max-w-420"
        style={{ marginTop: initialTopOffset }}
      >
        <div
          ref={dockRef}
          data-dock-rail
          className="nt-media-dock rounded-[28px] border border-white/18 bg-white/12 px-3 py-3 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-4xl sm:px-4 sm:py-4"
        >
          {historyLoading ? (
            <MediaSkeletonGrid count={10} />
          ) : images.length > 0 ? (
            <>
              <div
                data-media-grid
                className="grid gap-4"
                style={MEDIA_GRID_STYLE}
              >
                {images.map((image) => (
                  <MediaTile
                    key={image.id}
                    active={activeQuickActionKey === getStoredImageKey(image)}
                    copied={copiedImageKey === getStoredImageKey(image)}
                    deleteConfirming={
                      deleteConfirmKey === getStoredImageKey(image)
                    }
                    deleting={deletingId === image.id}
                    image={image}
                    onActivateActions={handleActivateActions}
                    onClearActions={handleClearActions}
                    onCopyImage={(quickImage) => {
                      void handleQuickCopy(quickImage);
                    }}
                    onDeleteImage={(quickImage) => {
                      void handleQuickDelete(quickImage);
                    }}
                    onDownloadImage={onDownloadImage}
                    onOpenImage={onOpenImage}
                  />
                ))}
              </div>
              {hasMore ? (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-black/24 px-4 text-sm font-medium text-white/78 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
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
            <div className="flex h-24 items-center justify-center rounded-[22px] border border-dashed border-white/16 bg-black/22 text-sm text-white/62 sm:h-28 lg:h-32">
              暂无媒体
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

function HeroImageLayer({
  blurred,
  image,
  onLoad,
  priority = false,
  visible,
}: {
  blurred: boolean;
  image: StoredImage;
  onLoad?: () => void;
  priority?: boolean;
  visible: boolean;
}) {
  return (
    <div
      className={`absolute inset-0 transition ease-out ${
        visible ? (blurred ? "opacity-[0.74]" : "opacity-100") : "opacity-0"
      } ${blurred ? "scale-105 blur-2xl" : "scale-100 blur-0"}`}
      style={{ transitionDuration: `${HERO_TRANSITION_MS}ms` }}
    >
      <div className="absolute inset-0">
        <MediaPreview
          src={image.url}
          alt={image.name}
          mediaType={image.mediaType}
          className="object-cover"
          imageProps={{
            fill: true,
            loading: priority ? "eager" : "lazy",
            fetchPriority: priority ? "high" : "auto",
            placeholder: HERO_IMAGE_PLACEHOLDER,
            sizes: "100vw",
            quality: 78,
            onLoad,
            transition: {
              overlayClassName: "duration-700",
              imageClassName: "duration-1000 ease-out",
            },
          }}
        />
      </div>
    </div>
  );
}

function HeroBackdrop({
  blurred,
  currentHero,
  currentReady,
  onCurrentHeroLoad,
  previousHero,
}: {
  blurred: boolean;
  currentHero: StoredImage | null;
  currentReady: boolean;
  onCurrentHeroLoad: () => void;
  previousHero: StoredImage | null;
}) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 overflow-hidden bg-[#050505] sm:fixed"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,0.12),transparent_25%),linear-gradient(135deg,#101216_0%,#0d1117_44%,#050505_100%)]" />
      <div
        className="absolute -inset-8 scale-105 bg-cover bg-center opacity-80 blur-2xl"
        style={{ backgroundImage: `url("${HERO_IMAGE_PLACEHOLDER}")` }}
      />
      {currentHero?.mediaType === "image" ? (
        <div className="absolute inset-0">
          {previousHero?.mediaType === "image" ? (
            <div className="absolute inset-0 z-0">
              <HeroImageLayer blurred={blurred} image={previousHero} visible />
            </div>
          ) : null}
          <div className="absolute inset-0 z-10">
            <HeroImageLayer
              key={getImageIdentity(currentHero)}
              blurred={blurred}
              image={currentHero}
              onLoad={onCurrentHeroLoad}
              priority
              visible={currentReady}
            />
          </div>
        </div>
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.28)_36%,rgba(0,0,0,0.04)_68%,rgba(0,0,0,0.32)_100%)]" />
      <div
        className={`absolute inset-0 transition duration-1000 ${
          blurred ? "bg-black/38 backdrop-blur-md" : "bg-black/0"
        }`}
      />
      <div className="absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_44%,rgba(0,0,0,0.72)_100%)] sm:block" />
    </div>
  );
}

export function TransferApp(props: TransferAppProps) {
  return <TransferAppContent {...props} />;
}

function TransferAppContent({
  initialAuthorized,
  initialPayload,
  onAuthorizedChange,
  onModeChange,
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
  const [heroBackdrop, setHeroBackdrop] = useState<HeroBackdropState>({
    current: null,
    previous: null,
    ready: false,
    version: 0,
  });
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
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareUploadOptions>(
    DEFAULT_SHARE_UPLOAD_OPTIONS,
  );
  const [sharePayload, setSharePayload] = useState<ShareUploadPayload | null>(
    null,
  );
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [uploadQueueVisible, setUploadQueueVisible] = useState(false);
  const [backgroundBlurred, setBackgroundBlurred] = useState(false);
  const activeSource = sources.find((source) => source.id === activeSourceId);
  const currentHeroIdentity = getImageIdentity(heroBackdrop.current);

  const updateHeroImage = useCallback((nextHero: StoredImage | null) => {
    setHeroBackdrop((state) => {
      if (isSameImage(state.current, nextHero)) {
        return state;
      }

      return {
        current: nextHero,
        previous: state.current && nextHero ? state.current : null,
        ready: false,
        version: state.version + 1,
      };
    });
  }, []);

  const applyImagesPayload = useCallback(
    (
      payload: ImagesPayload,
      options: {
        append?: boolean;
        resetHero?: boolean;
        clearSelected?: boolean;
      } = {},
    ) => {
      setSources(payload.sources);
      setActiveSourceId(payload.activeSourceId);
      setImages((currentImages) => {
        if (!options.append) {
          return payload.images;
        }

        const knownImages = new Set(
          currentImages.map((image) => `${image.sourceId}:${image.id}`),
        );

        return [
          ...currentImages,
          ...payload.images.filter((image) => {
            const imageKey = `${image.sourceId}:${image.id}`;

            if (knownImages.has(imageKey)) {
              return false;
            }

            knownImages.add(imageKey);
            return true;
          }),
        ];
      });
      setStorageUsage(payload.storageUsage ?? EMPTY_STORAGE_USAGE);
      setHasMoreImages(payload.pagination.hasMore);
      setNextImagesCursor(payload.pagination.nextCursor);

      if (options.clearSelected) {
        setSelectedImage(null);
      }

      setHeroBackdrop((state) => {
        if (options.append) {
          return state;
        }

        const current = state.current;
        const currentStillExists = payload.images.some((image) => {
          return (
            image.mediaType === "image" &&
            image.id === current?.id &&
            image.sourceId === current?.sourceId
          );
        });

        if (options.resetHero || !current || !currentStillExists) {
          const nextHero = pickPreferredHeroImage(payload.images);

          if (isSameImage(current, nextHero)) {
            return state;
          }

          return {
            current: nextHero,
            previous: current && nextHero ? current : null,
            ready: false,
            version: state.version + 1,
          };
        }

        return state;
      });
    },
    [],
  );

  const openImageViewer = useCallback((image: StoredImage) => {
    setSelectedImage(image);
  }, []);

  const selectImageInViewer = useCallback((image: StoredImage) => {
    setSelectedImage(image);
  }, []);

  const handleHeroImageLoad = useCallback(() => {
    setHeroBackdrop((state) => {
      if (state.ready) {
        return state;
      }

      return {
        ...state,
        ready: true,
      };
    });
  }, []);

  useEffect(() => {
    if (!heroBackdrop.previous || !heroBackdrop.ready) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHeroBackdrop((state) => {
        if (!state.previous) {
          return state;
        }

        return {
          ...state,
          previous: null,
        };
      });
    }, HERO_PREVIOUS_RETENTION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [heroBackdrop.previous, heroBackdrop.ready, heroBackdrop.version]);

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

        const payload = (await response.json()) as ImagesPayload;

        if (!cancelled) {
          setPageError("");
          applyImagesPayload(payload, { resetHero: true });
          setNeedsInitialFetch(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthorized(false);
          setAuthNotice("登录状态失效，请重新输入密码。");
          setSelectedImage(null);
          setBackgroundBlurred(false);
        }
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

  useEffect(() => {
    if (!authorized) {
      return;
    }

    let frameId = 0;

    function syncBackgroundState() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const blurThreshold = Math.max(32, window.innerHeight * 0.08);
        setBackgroundBlurred(window.scrollY > blurThreshold);
      });
    }

    syncBackgroundState();
    window.addEventListener("scroll", syncBackgroundState, { passive: true });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", syncBackgroundState);
    };
  }, [authorized]);

  useEffect(() => {
    if (!authorized || images.length === 0) {
      return;
    }

    const nextHero = currentHeroIdentity
      ? pickStoredHeroImage(images)
      : pickPreferredHeroImage(images);

    if (!nextHero || getImageIdentity(nextHero) === currentHeroIdentity) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      updateHeroImage(nextHero);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authorized, currentHeroIdentity, images, updateHeroImage]);

  async function handleLogin(password: string, options: { liteMode: boolean }) {
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

      if (options.liteMode) {
        onAuthorizedChange?.(true);
        onModeChange("lite");
        return null;
      }

      setHistoryLoading(true);
      setNeedsInitialFetch(true);
      setAuthorized(true);
      onAuthorizedChange?.(true);
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
    updateHeroImage(null);
    setSelectedImage(null);
    setBackgroundBlurred(false);
    onAuthorizedChange?.(false);
  }

  const refreshImages = useCallback(
    async (options: { resetHero?: boolean } = {}) => {
      const response = await fetch(`/api/images?limit=${IMAGES_PAGE_SIZE}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("refresh failed");
      }

      const payload = (await response.json()) as ImagesPayload;
      startTransition(() => {
        applyImagesPayload(payload, options);
      });
    },
    [applyImagesPayload],
  );

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
        applyImagesPayload(payload, { append: true });
      });
      setPageError("");
    } catch {
      setPageError("加载更多失败，请稍后重试。");
    } finally {
      setLoadingMoreImages(false);
    }
  }

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
        applyImagesPayload(payload, {
          clearSelected: true,
          resetHero: true,
        });
      });
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
      await refreshImages({ resetHero: true });
      setPageError("");
    } catch {
      setPageError("刷新失败，请稍后重试。");
    } finally {
      setRefreshingImages(false);
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
      setHeroBackdrop((state) => {
        const deletingCurrent = isSameImage(state.current, image);
        const deletingPrevious = isSameImage(state.previous, image);
        const nextImages = images.filter((item) => {
          return item.id !== image.id || item.sourceId !== image.sourceId;
        });

        if (isSameImage(image, pickStoredHeroImage([image]))) {
          writeStoredHeroIdentity(pickPreferredHeroImage(nextImages));
        }

        if (!deletingCurrent && !deletingPrevious) {
          return state;
        }

        return {
          current: deletingCurrent
            ? pickPreferredHeroImage(nextImages)
            : state.current,
          previous: deletingPrevious ? null : state.previous,
          ready: deletingCurrent ? false : state.ready,
          version: state.version + 1,
        };
      });
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

  function handleCloseImageViewer() {
    const imageForBackground =
      selectedImage?.mediaType === "image" ? selectedImage : null;

    setSelectedImage(null);

    if (
      imageForBackground &&
      !isSameImage(heroBackdrop.current, imageForBackground)
    ) {
      writeStoredHeroIdentity(imageForBackground);
      updateHeroImage(imageForBackground);
    } else if (imageForBackground) {
      writeStoredHeroIdentity(imageForBackground);
    }
  }

  if (!authorized) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <main className="relative min-h-svh overflow-x-hidden bg-[#050505] text-white sm:min-h-dvh">
      <header className="relative z-40 bg-[#050505] px-2 pb-3 pt-[calc(0.6rem+env(safe-area-inset-top,0))] sm:contents sm:bg-transparent sm:p-0">
        <div className="flex w-full max-w-none flex-col gap-2 rounded-3xl border border-white/14 bg-white/8 p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:fixed sm:right-6 sm:top-6 sm:z-40 sm:w-auto sm:max-w-full sm:flex-row sm:items-center sm:gap-2 sm:rounded-full sm:bg-black/28">
          <div className="flex min-w-0 items-center gap-2 sm:contents">
            <StorageSourceSelect
              activeSourceId={activeSourceId}
              disabled={switchingSource || historyLoading}
              sources={sources}
              onChange={(sourceId) => void handleStorageSourceChange(sourceId)}
            />
            <StorageUsageBadge usage={storageUsage} />
          </div>
          <div className="flex justify-end gap-2 sm:contents">
            <button
              type="button"
              onClick={openShareUploadDialog}
              disabled={!activeSourceId || historyLoading}
              aria-label="生成上传二维码"
              title="生成上传二维码"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              <QrCodeIcon className="size-5" />
            </button>
            {sources.length > 1 ? (
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                aria-label="迁移媒体"
                title="迁移媒体"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white"
              >
                <ArrowsRightLeftIcon className="size-5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleRefreshImages()}
              disabled={refreshingImages}
              aria-label={refreshingImages ? "刷新中" : "刷新媒体库"}
              title={refreshingImages ? "刷新中" : "刷新媒体库"}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              <ArrowPathIcon
                className={`size-5 ${refreshingImages ? "animate-spin" : ""}`}
              />
            </button>
            <button
              type="button"
              onClick={() => onModeChange("lite")}
              aria-label="极速版"
              title="极速版"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/68 transition hover:bg-white/14 hover:text-white"
            >
              <DevicePhoneMobileIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="退出登录"
              title="退出登录"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white"
            >
              <PowerIcon className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <section
        className={`relative z-30 flex overflow-hidden rounded-t-4xl shadow-[0_-18px_60px_rgba(0,0,0,0.34)] transition-[height,min-height] duration-300 sm:z-10 sm:rounded-none sm:shadow-none ${
          uploadQueueVisible
            ? "min-h-[calc(100svh+12rem)] sm:min-h-0 sm:h-dvh"
            : "h-[calc(100svh-10rem)] min-h-[30rem] sm:h-dvh"
        }`}
      >
        <HeroBackdrop
          blurred={backgroundBlurred}
          currentHero={heroBackdrop.current}
          currentReady={heroBackdrop.ready}
          onCurrentHeroLoad={handleHeroImageLoad}
          previousHero={heroBackdrop.previous}
        />
        <div className="relative z-20 flex w-full flex-col px-5 pb-56 pt-24 sm:px-8 sm:pb-64 sm:pt-28 lg:px-14">
          <div className="max-w-xl pt-[16svh] sm:pt-[10vh]">
            <h1 className={PAGE_TITLE_CLASS}>{DEFAULT_PAGE_TITLE}</h1>
            <div className="relative z-40 mt-14">
              <TransferUploadPanel
                onQueueVisibilityChange={setUploadQueueVisible}
                onUploaded={refreshImages}
                sourceId={activeSourceId}
                sourcePrefix={activeSource?.prefix ?? "uploads/"}
                uploadMode={activeSource?.uploadMode ?? DEFAULT_UPLOAD_MODE}
              />
            </div>
            {pageError ? (
              <p className="mt-4 max-w-sm rounded-2xl border border-rose-300/18 bg-rose-950/35 px-4 py-3 text-sm text-rose-100 backdrop-blur-xl">
                {pageError}
              </p>
            ) : null}
          </div>
        </div>
        <div
          aria-hidden
          className="nt-scroll-cue pointer-events-none absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 z-30 flex size-11 items-center justify-center rounded-full border border-white/34 bg-black/18 text-white/84 shadow-[0_12px_30px_rgba(0,0,0,0.34)] ring-1 ring-white/10 backdrop-blur-xl sm:hidden"
        >
          <ChevronDoubleDownIcon className="size-5.5 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]" />
        </div>
      </section>

      <MediaShelf
        deletingId={deletingId}
        hasMore={hasMoreImages}
        historyLoading={historyLoading}
        images={images}
        loadingMore={loadingMoreImages}
        onCopyImage={handleCopyLink}
        onDeleteImage={handleDelete}
        onDownloadImage={handleDownload}
        onLoadMore={() => void handleLoadMoreImages()}
        onOpenImage={openImageViewer}
      />

      {selectedImage ? (
        <ImageViewerModal
          key={selectedImage.id}
          deletingId={deletingId}
          images={images}
          selectedImage={selectedImage}
          onClose={handleCloseImageViewer}
          onCopyLink={handleCopyLink}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onSelectImage={selectImageInViewer}
        />
      ) : null}

      {transferModalOpen ? (
        <SourceTransferModal
          activeSourceId={activeSourceId}
          images={images}
          sources={sources}
          onClose={() => setTransferModalOpen(false)}
          onTransferred={() => refreshImages({ resetHero: true })}
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
