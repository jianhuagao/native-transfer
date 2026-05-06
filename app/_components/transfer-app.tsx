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
  memo,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const EMPTY_STORAGE_USAGE: StorageUsage = {
  totalBytes: 0,
  usedBytes: 0,
  percent: 0,
};
const DEFAULT_UPLOAD_MODE = "form-data";
const HERO_SWITCH_DELAY_MS = 400;
const HERO_TRANSITION_MS = 600;
const HERO_PREVIOUS_RETENTION_MS = 1900;
const MEDIA_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 13rem), 1fr))",
};
const MEDIA_TILE_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 960px) 33vw, (max-width: 1280px) 25vw, (max-width: 1680px) 20vw, 16vw";

type HeroBackdropState = {
  current: StoredImage | null;
  previous: StoredImage | null;
  ready: boolean;
  version: number;
};

function pickLatestHeroImage(images: StoredImage[]) {
  return images.find((image) => image.mediaType === "image") ?? null;
}

function getImageIdentity(image: StoredImage | null) {
  return image ? `${image.sourceId}:${image.id}` : "";
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

const MediaTile = memo(function MediaTile({
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
          loadingEffect: "fade",
          sizes: MEDIA_TILE_IMAGE_SIZES,
          quality: 70,
          decoding: "async",
          transition: {
            overlayClassName: "duration-300",
            imageClassName: "duration-300 ease-out",
          },
        }}
      />
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.36))]" />
    </button>
  );
});

function MediaSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid gap-4" style={MEDIA_GRID_STYLE}>
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
  historyLoading,
  images,
  onOpenImage,
}: {
  historyLoading: boolean;
  images: StoredImage[];
  onOpenImage: (image: StoredImage) => void;
}) {
  return (
    <section className="relative z-30 px-3 pb-14 sm:px-6 sm:pb-20 lg:px-10">
      <div className="nt-media-frame mx-auto max-w-420">
        <div className="nt-media-positioner">
          <div
            data-dock-rail
            className="nt-media-dock rounded-[28px] border border-white/18 bg-white/12 px-3 py-3 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[32px] sm:px-4 sm:py-4"
          >
            {historyLoading ? (
              <MediaSkeletonGrid count={10} />
            ) : images.length > 0 ? (
              <div className="grid gap-4" style={MEDIA_GRID_STYLE}>
                {images.map((image) => (
                  <MediaTile
                    key={image.id}
                    image={image}
                    onOpenImage={onOpenImage}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center rounded-[22px] border border-dashed border-white/16 bg-black/22 text-sm text-white/62 sm:h-28 lg:h-32">
                暂无媒体
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

function HeroImageLayer({
  blurred,
  image,
  onLoad,
  visible,
}: {
  blurred: boolean;
  image: StoredImage;
  onLoad?: () => void;
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
            loading: "eager",
            fetchPriority: "high",
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
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden bg-[#050505]">
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
  const [heroBackdrop, setHeroBackdrop] = useState<HeroBackdropState>({
    current: null,
    previous: null,
    ready: false,
    version: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(initialAuthorized);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [backgroundBlurred, setBackgroundBlurred] = useState(false);
  const delayedHeroUpdateRef = useRef<number | null>(null);
  const activeSource = sources.find((source) => source.id === activeSourceId);

  const cancelDelayedHeroUpdate = useCallback(() => {
    if (delayedHeroUpdateRef.current === null) {
      return;
    }

    window.clearTimeout(delayedHeroUpdateRef.current);
    delayedHeroUpdateRef.current = null;
  }, []);

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
      options: { resetHero?: boolean; clearSelected?: boolean } = {},
    ) => {
      setSources(payload.sources);
      setActiveSourceId(payload.activeSourceId);
      setImages(payload.images);
      setStorageUsage(payload.storageUsage ?? EMPTY_STORAGE_USAGE);

      if (options.resetHero) {
        cancelDelayedHeroUpdate();
      }

      if (options.clearSelected) {
        cancelDelayedHeroUpdate();
        setSelectedImage(null);
      }

      setHeroBackdrop((state) => {
        const current = state.current;
        const currentStillExists = payload.images.some((image) => {
          return (
            image.mediaType === "image" &&
            image.id === current?.id &&
            image.sourceId === current?.sourceId
          );
        });

        if (options.resetHero || !current || !currentStillExists) {
          const nextHero = pickLatestHeroImage(payload.images);

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
    [cancelDelayedHeroUpdate],
  );

  const openImageViewer = useCallback(
    (image: StoredImage) => {
      cancelDelayedHeroUpdate();
      setSelectedImage(image);
    },
    [cancelDelayedHeroUpdate],
  );

  const selectImageInViewer = useCallback(
    (image: StoredImage) => {
      cancelDelayedHeroUpdate();
      setSelectedImage(image);
    },
    [cancelDelayedHeroUpdate],
  );

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
    return () => {
      if (delayedHeroUpdateRef.current !== null) {
        window.clearTimeout(delayedHeroUpdateRef.current);
      }
    };
  }, []);

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
          applyImagesPayload(payload, { resetHero: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthorized(false);
          setAuthNotice("登录状态失效，请重新输入密码。");
          cancelDelayedHeroUpdate();
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
  }, [applyImagesPayload, authorized, cancelDelayedHeroUpdate]);

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

    cancelDelayedHeroUpdate();

    setPageError("");
    setAuthorized(false);
    setImages([]);
    setSources([]);
    setActiveSourceId("");
    setStorageUsage(EMPTY_STORAGE_USAGE);
    updateHeroImage(null);
    setSelectedImage(null);
    setBackgroundBlurred(false);
  }

  const refreshImages = useCallback(
    async (options: { resetHero?: boolean } = {}) => {
      const response = await fetch("/api/images", { cache: "no-store" });

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
        cancelDelayedHeroUpdate();
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

    cancelDelayedHeroUpdate();

    setSelectedImage(null);

    if (imageForBackground) {
      delayedHeroUpdateRef.current = window.setTimeout(() => {
        updateHeroImage(imageForBackground);
        delayedHeroUpdateRef.current = null;
      }, HERO_SWITCH_DELAY_MS);
    }
  }

  if (!authorized) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#050505] text-white">
      <HeroBackdrop
        blurred={backgroundBlurred}
        currentHero={heroBackdrop.current}
        currentReady={heroBackdrop.ready}
        onCurrentHeroLoad={handleHeroImageLoad}
        previousHero={heroBackdrop.previous}
      />

      <div className="absolute left-4 right-4 top-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-[24px] border border-white/14 bg-black/28 p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:fixed sm:left-auto sm:right-6 sm:top-6 sm:max-w-none sm:flex-row sm:items-center sm:gap-2 sm:rounded-full">
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

      <section className="relative z-10 flex h-[100dvh]">
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
    </main>
  );
}
