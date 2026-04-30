"use client";

import { ImageViewerModal } from "@/app/_components/transfer/image-viewer-modal";
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
  ArrowPathIcon,
  CircleStackIcon,
  PowerIcon,
} from "@heroicons/react/24/solid";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const EMPTY_STORAGE_USAGE: StorageUsage = {
  totalBytes: 0,
  usedBytes: 0,
  percent: 0,
};
const HERO_CACHE_KEY = "native-transfer:last-hero";
const DEFAULT_UPLOAD_MODE = "form-data";
const DEFAULT_DOCK_COLUMN_COUNT = 4;
const DEFAULT_DOCK_HEIGHT = 160;
const MEDIA_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 13rem), 1fr))",
};
const MEDIA_TILE_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 960px) 33vw, (max-width: 1280px) 25vw, (max-width: 1680px) 20vw, 16vw";

function isStoredImage(value: unknown): value is StoredImage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const image = value as Partial<StoredImage>;

  return (
    typeof image.id === "string" &&
    typeof image.sourceId === "string" &&
    typeof image.sourceLabel === "string" &&
    typeof image.name === "string" &&
    (image.mediaType === "image" || image.mediaType === "video") &&
    typeof image.mimeType === "string" &&
    typeof image.url === "string" &&
    typeof image.originalUrl === "string" &&
    typeof image.uploadedAt === "string" &&
    typeof image.uploadedAtLabel === "string" &&
    typeof image.size === "number"
  );
}

function getHeroCacheKey(sourceId: string) {
  return `${HERO_CACHE_KEY}:${sourceId}`;
}

function readCachedHeroImage(sourceId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(getHeroCacheKey(sourceId));

    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as unknown;
    return isStoredImage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedHeroImage(sourceId: string, image: StoredImage | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (image) {
      window.localStorage.setItem(
        getHeroCacheKey(sourceId),
        JSON.stringify(image),
      );
      return;
    }

    window.localStorage.removeItem(getHeroCacheKey(sourceId));
  } catch {
    return;
  }
}

function pickRandomImage(images: StoredImage[]) {
  if (images.length === 0) {
    return null;
  }

  return images[Math.floor(Math.random() * images.length)] ?? null;
}

function formatStoragePercent(percent: number, usedBytes: number) {
  if (usedBytes > 0 && percent > 0 && percent < 1) {
    return "<1%";
  }

  return `${Math.round(percent)}%`;
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
      <div className="min-w-0 flex-1 sm:min-w-[7.25rem]">
        <div className="flex items-center justify-between gap-2 text-[11px] leading-none">
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
      <span className="hidden text-[11px] text-white/48 sm:inline">源</span>
      <select
        value={activeSourceId}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 max-w-full bg-transparent text-sm font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-55 sm:max-w-[9rem]"
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

function getRenderedGridColumnCount(element: HTMLElement) {
  const columns = window.getComputedStyle(element).gridTemplateColumns;

  if (!columns || columns === "none") {
    return 0;
  }

  return columns.split(" ").filter(Boolean).length;
}

function useGridColumnCount() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(DEFAULT_DOCK_COLUMN_COUNT);

  useEffect(() => {
    const grid = gridRef.current;

    if (!grid) {
      return;
    }

    const gridElement = grid;
    let frameId = 0;

    function syncColumnCount() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextColumnCount = getRenderedGridColumnCount(gridElement);

        if (nextColumnCount > 0) {
          setColumnCount((current) =>
            current === nextColumnCount ? current : nextColumnCount,
          );
        }
      });
    }

    syncColumnCount();

    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(syncColumnCount) : null;

    resizeObserver?.observe(gridElement);
    window.addEventListener("resize", syncColumnCount);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncColumnCount);
    };
  }, []);

  return { columnCount, gridRef };
}

function useElementHeight<TElement extends HTMLElement>() {
  const elementRef = useRef<TElement | null>(null);
  const [height, setHeight] = useState(DEFAULT_DOCK_HEIGHT);

  useEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    const measuredElement = element;
    let frameId = 0;

    function syncHeight() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextHeight = Math.ceil(
          measuredElement.getBoundingClientRect().height,
        );

        if (nextHeight > 0) {
          setHeight((current) =>
            current === nextHeight ? current : nextHeight,
          );
        }
      });
    }

    syncHeight();

    const resizeObserver =
      "ResizeObserver" in window ? new ResizeObserver(syncHeight) : null;

    resizeObserver?.observe(measuredElement);
    window.addEventListener("resize", syncHeight);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  return { elementRef, height };
}

function MediaTile({
  image,
  onOpenImage,
}: {
  image: StoredImage;
  onOpenImage: (image: StoredImage) => void;
}) {
  return (
    <button
      key={image.id}
      type="button"
      onClick={() => onOpenImage(image)}
      className="group relative aspect-[1.58] overflow-hidden rounded-[22px] border border-white/12 bg-black/30 text-left shadow-[0_16px_42px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-white/42 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
    >
      <MediaPreview
        src={image.url}
        alt={image.name}
        mediaType={image.mediaType}
        className="object-cover transition duration-500 group-hover:scale-105"
        imageProps={{
          fill: true,
          sizes: MEDIA_TILE_IMAGE_SIZES,
          quality: 70,
          decoding: "async",
        }}
      />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.36))]" />
    </button>
  );
}

function MediaSkeletonGrid({
  count,
  gridRef,
}: {
  count: number;
  gridRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div ref={gridRef} className="grid gap-3 sm:gap-4" style={MEDIA_GRID_STYLE}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="aspect-[1.58] animate-pulse rounded-[22px] border border-white/8 bg-white/10"
        />
      ))}
    </div>
  );
}

function MediaShelf({
  historyLoading,
  images,
  onOpenImage,
}: {
  historyLoading: boolean;
  images: StoredImage[];
  onOpenImage: (image: StoredImage) => void;
}) {
  const { columnCount, gridRef } = useGridColumnCount();
  const { elementRef: dockRef, height: dockHeight } =
    useElementHeight<HTMLDivElement>();
  const dockImages = images.slice(0, columnCount);
  const remainingImages = images.slice(columnCount);
  const loadingRemainderCount = Math.max(columnCount * 2, 6);

  return (
    <section
      className="relative z-30 px-3 pb-14 sm:px-6 sm:pb-20 lg:px-10"
      style={{ marginTop: -dockHeight }}
    >
      <div className="mx-auto max-w-[96rem]">
        <div
          ref={dockRef}
          data-dock-rail
          className="rounded-[28px] border border-white/18 bg-white/12 px-3 py-3 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[32px] sm:px-4 sm:py-4"
        >
          {historyLoading ? (
            <MediaSkeletonGrid count={columnCount} gridRef={gridRef} />
          ) : images.length > 0 ? (
            <div
              ref={gridRef}
              className="grid gap-3 sm:gap-4"
              style={MEDIA_GRID_STYLE}
            >
              {dockImages.map((image) => (
                <MediaTile
                  key={image.id}
                  image={image}
                  onOpenImage={onOpenImage}
                />
              ))}
            </div>
          ) : (
            <div className="flex aspect-[1.58] items-center justify-center rounded-[22px] border border-dashed border-white/16 bg-black/22 text-sm text-white/62">
              暂无媒体
            </div>
          )}
        </div>

        {historyLoading ? (
          <div className="mt-3 sm:mt-4">
            <MediaSkeletonGrid count={loadingRemainderCount} />
          </div>
        ) : remainingImages.length > 0 ? (
          <div
            className="mt-3 grid gap-3 sm:mt-4 sm:gap-4"
            style={MEDIA_GRID_STYLE}
          >
            {remainingImages.map((image) => (
              <MediaTile
                key={image.id}
                image={image}
                onOpenImage={onOpenImage}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HeroBackdrop({
  blurred,
  heroImage,
}: {
  blurred: boolean;
  heroImage: StoredImage | null;
}) {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,0.12),transparent_25%),linear-gradient(135deg,#101216_0%,#0d1117_44%,#050505_100%)]" />
      <div
        className="absolute -inset-8 scale-105 bg-cover bg-center opacity-80 blur-2xl"
        style={{ backgroundImage: `url("${HERO_IMAGE_PLACEHOLDER}")` }}
      />
      {heroImage ? (
        <div
          className={`absolute inset-0 transition duration-700 ease-out ${
            blurred
              ? "scale-105 opacity-[0.74] blur-2xl"
              : "scale-100 opacity-100"
          }`}
        >
          {heroImage.mediaType === "video" ? (
            <MediaPreview
              key={`${heroImage.id}:${blurred ? "still" : "motion"}`}
              src={heroImage.url}
              alt={heroImage.name}
              mediaType={heroImage.mediaType}
              className="absolute inset-0 object-cover"
              showVideoBadge={false}
              videoProps={
                blurred
                  ? {
                      "aria-hidden": true,
                      preload: "metadata",
                    }
                  : {
                      autoPlay: true,
                      loop: true,
                      "aria-hidden": true,
                    }
              }
            />
          ) : (
            <MediaPreview
              src={heroImage.url}
              alt={heroImage.name}
              mediaType={heroImage.mediaType}
              className="object-cover"
              imageProps={{
                fill: true,
                loading: "eager",
                fetchPriority: "high",
                placeholder: HERO_IMAGE_PLACEHOLDER,
                sizes: "100vw",
                quality: 78,
                transition: {
                  overlayClassName: "duration-700",
                  imageClassName: "duration-1000 ease-out",
                },
              }}
            />
          )}
        </div>
      ) : null}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.28)_36%,rgba(0,0,0,0.04)_68%,rgba(0,0,0,0.32)_100%)]" />
      <div
        className={`absolute inset-0 transition duration-700 ${
          blurred ? "bg-black/38 backdrop-blur-md" : "bg-black/0"
        }`}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_44%,rgba(0,0,0,0.72)_100%)]" />
    </div>
  );
}

export function TransferApp(props: TransferAppProps) {
  return <TransferAppContent {...props} />;
}

function TransferAppContent({ initialAuthorized }: TransferAppProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [authNotice, setAuthNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [images, setImages] = useState<StoredImage[]>([]);
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [activeSourceId, setActiveSourceId] = useState("");
  const [storageUsage, setStorageUsage] =
    useState<StorageUsage>(EMPTY_STORAGE_USAGE);
  const [heroImage, setHeroImage] = useState<StoredImage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(initialAuthorized);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [backgroundBlurred, setBackgroundBlurred] = useState(false);
  const activeSource = sources.find((source) => source.id === activeSourceId);

  function applyImagesPayload(
    payload: ImagesPayload,
    options: { randomizeHero?: boolean; clearSelected?: boolean } = {},
  ) {
    setSources(payload.sources);
    setActiveSourceId(payload.activeSourceId);
    setImages(payload.images);
    setStorageUsage(payload.storageUsage ?? EMPTY_STORAGE_USAGE);

    if (options.clearSelected) {
      setSelectedImage(null);
    }

    setHeroImage((current) => {
      const currentStillExists = payload.images.some((image) => {
        return image.id === current?.id && image.sourceId === current?.sourceId;
      });

      if (options.randomizeHero || !current || !currentStillExists) {
        return pickRandomImage(payload.images);
      }

      return current;
    });
  }

  useEffect(() => {
    if (!authorized || heroImage || !activeSourceId) {
      return;
    }

    let cancelled = false;

    Promise.resolve().then(() => {
      const cachedHeroImage = readCachedHeroImage(activeSourceId);

      if (!cancelled && cachedHeroImage) {
        setHeroImage(cachedHeroImage);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSourceId, authorized, heroImage]);

  useEffect(() => {
    if (!authorized || !activeSourceId) {
      return;
    }

    if (heroImage) {
      writeCachedHeroImage(activeSourceId, heroImage);
    }
  }, [activeSourceId, authorized, heroImage]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    let cancelled = false;

    fetch("/api/images", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("load failed");
        }

        const payload = (await response.json()) as ImagesPayload;

        if (!cancelled) {
          setPageError("");
          applyImagesPayload(payload, { randomizeHero: true });
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
  }, [authorized]);

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
    window.addEventListener("resize", syncBackgroundState);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", syncBackgroundState);
      window.removeEventListener("resize", syncBackgroundState);
    };
  }, [authorized]);

  async function handleLogin(password: string) {
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

      setHistoryLoading(true);
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
    setHeroImage(null);
    setSelectedImage(null);
    setBackgroundBlurred(false);
  }

  async function refreshImages(options: { randomizeHero?: boolean } = {}) {
    const response = await fetch("/api/images", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("refresh failed");
    }

    const payload = (await response.json()) as ImagesPayload;
    startTransition(() => {
      applyImagesPayload(payload, options);
    });
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
          randomizeHero: true,
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
      await refreshImages({ randomizeHero: true });
      setPageError("");
    } catch {
      setPageError("刷新失败，请稍后重试。");
    } finally {
      setRefreshingImages(false);
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

      const payload = (await response.json()) as ImagesPayload;
      applyImagesPayload(payload);
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
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <HeroBackdrop blurred={backgroundBlurred} heroImage={heroImage} />

      <div className="fixed left-4 right-4 top-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-[24px] border border-white/14 bg-black/28 p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:left-auto sm:right-6 sm:top-6 sm:max-w-none sm:flex-row sm:items-center sm:gap-2 sm:rounded-full">
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
            onClick={() => void handleLogout()}
            aria-label="退出登录"
            title="退出登录"
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white"
          >
            <PowerIcon className="size-5" />
          </button>
        </div>
      </div>

      <section className="relative z-10 flex min-h-[100svh]">
        <div className="relative z-20 flex w-full flex-col px-5 pb-56 pt-24 sm:px-8 sm:pb-64 sm:pt-28 lg:px-14">
          <div className="max-w-xl pt-[16vh] sm:pt-[10vh]">
            <h1 className="text-4xl font-semibold leading-none text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:text-6xl lg:text-7xl">
              Native Transfer
            </h1>
            <div className="mt-14">
              <TransferUploadPanel
                onUploaded={refreshImages}
                sourceId={activeSourceId}
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
      </section>

      <MediaShelf
        historyLoading={historyLoading}
        images={images}
        onOpenImage={setSelectedImage}
      />

      {selectedImage ? (
        <ImageViewerModal
          key={selectedImage.id}
          deletingId={deletingId}
          images={images}
          selectedImage={selectedImage}
          onClose={() => setSelectedImage(null)}
          onCopyLink={handleCopyLink}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onSelectImage={setSelectedImage}
        />
      ) : null}
    </main>
  );
}
