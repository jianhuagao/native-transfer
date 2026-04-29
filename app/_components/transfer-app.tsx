"use client";

import { SuccessConfetti } from "@/app/_components/success-confetti";
import { HistoryPanel } from "@/app/_components/transfer/history-panel";
import { ImageViewerModal } from "@/app/_components/transfer/image-viewer-modal";
import { LoginScreen } from "@/app/_components/transfer/login-screen";
import { TransferUploadPanel } from "@/app/_components/transfer/transfer-upload-panel";
import type {
  ConfettiKind,
  StoredImage,
  TransferAppProps,
} from "@/app/_components/transfer/types";
import {
  buildDeleteImagePath,
  isTouchLikeDevice,
  withRefreshVersion,
} from "@/app/_components/transfer/utils";
import copySuccessAnimation from "@/public/lotties/confetti-copy-success.json";
import uploadSuccessAnimation from "@/public/lotties/confetti-upload-success.json";
import { MediaPreview } from "@/app/_components/transfer/media-preview";
import {
  ArrowPathIcon,
  ChevronUpIcon,
  PowerIcon,
} from "@heroicons/react/24/solid";
import { startTransition, useEffect, useRef, useState } from "react";

function pickRandomImage(images: StoredImage[]) {
  if (images.length === 0) {
    return null;
  }

  return images[Math.floor(Math.random() * images.length)] ?? null;
}

function getDockPreviewCount() {
  if (typeof window === "undefined") {
    return 4;
  }

  if (window.innerWidth >= 1536) {
    return 6;
  }

  if (window.innerWidth >= 1280) {
    return 5;
  }

  if (window.innerWidth >= 768) {
    return 4;
  }

  if (window.innerWidth >= 640) {
    return 3;
  }

  return 2;
}

function GalleryRail({
  historyLoading,
  imageRefreshVersion,
  images,
  onOpenImage,
  onScrollToGallery,
}: {
  historyLoading: boolean;
  imageRefreshVersion: number;
  images: StoredImage[];
  onOpenImage: (image: StoredImage) => void;
  onScrollToGallery: () => void;
}) {
  const [previewCount, setPreviewCount] = useState(4);
  const dockImages = images.slice(0, previewCount);

  useEffect(() => {
    function syncPreviewCount() {
      setPreviewCount(getDockPreviewCount());
    }

    syncPreviewCount();
    window.addEventListener("resize", syncPreviewCount);

    return () => {
      window.removeEventListener("resize", syncPreviewCount);
    };
  }, []);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 px-3 pb-4 sm:px-6 lg:px-10">
      <button
        type="button"
        aria-label="展开媒体库"
        title="展开媒体库"
        onClick={onScrollToGallery}
        className="mx-auto mb-2 flex h-8 w-12 items-center justify-center rounded-full border border-white/14 bg-black/28 text-white/72 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:bg-white/14"
      >
        <ChevronUpIcon className="size-5" />
      </button>

      <div
        data-dock-rail
        className="mx-auto max-w-[96rem] rounded-[28px] border border-white/18 bg-white/12 px-3 py-3 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-[32px] sm:px-4 sm:py-4"
      >
        {historyLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {Array.from({ length: previewCount }).map((_, index) => (
              <div
                key={index}
                className="h-24 animate-pulse rounded-[22px] border border-white/8 bg-white/10 sm:h-32 lg:h-36"
              />
            ))}
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {dockImages.map((image) => (
              <button
                key={image.id}
                type="button"
                data-dock-item
                onClick={() => onOpenImage(image)}
                className="group relative h-24 overflow-hidden rounded-[22px] border border-white/12 bg-black/30 text-left shadow-[0_16px_42px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-white/42 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 sm:h-32 lg:h-36"
              >
                <MediaPreview
                  src={withRefreshVersion(image.url, imageRefreshVersion)}
                  alt={image.name}
                  mediaType={image.mediaType}
                  className="object-cover transition duration-500 group-hover:scale-105"
                  imageProps={{
                    fill: true,
                    sizes:
                      "(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 16vw",
                    quality: 70,
                    decoding: "async",
                  }}
                />
                <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.36))]" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-[22px] border border-dashed border-white/16 bg-black/22 text-sm text-white/62">
            暂无媒体
          </div>
        )}
      </div>
    </div>
  );
}

export function TransferApp({ initialAuthorized }: TransferAppProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [authNotice, setAuthNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [images, setImages] = useState<StoredImage[]>([]);
  const [heroImage, setHeroImage] = useState<StoredImage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(initialAuthorized);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [imageRefreshVersion, setImageRefreshVersion] = useState(0);
  const [confettiToken, setConfettiToken] = useState(0);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [confettiKind, setConfettiKind] = useState<ConfettiKind | null>(null);
  const galleryRef = useRef<HTMLElement | null>(null);
  const lastAutoScrollAtRef = useRef(0);

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

        const payload = (await response.json()) as { images: StoredImage[] };

        if (!cancelled) {
          setPageError("");
          setImages(payload.images);
          setHeroImage(pickRandomImage(payload.images));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthorized(false);
          setAuthNotice("登录状态失效，请重新输入密码。");
          setSelectedImage(null);
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

    setConfettiVisible(false);
    setConfettiKind(null);
    setConfettiToken(0);
    setPageError("");
    setAuthorized(false);
    setImages([]);
    setHeroImage(null);
    setSelectedImage(null);
  }

  function playSuccessConfetti(kind: ConfettiKind) {
    setConfettiKind(kind);
    setConfettiVisible(true);
    setConfettiToken((current) => current + 1);
  }

  async function refreshImages(options: { randomizeHero?: boolean } = {}) {
    const response = await fetch("/api/images", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("refresh failed");
    }

    const payload = (await response.json()) as { images: StoredImage[] };
    startTransition(() => {
      setImages(payload.images);
      setHeroImage((current) => {
        const currentStillExists = payload.images.some(
          (image) => image.id === current?.id,
        );

        if (options.randomizeHero || !current || !currentStillExists) {
          return pickRandomImage(payload.images);
        }

        return current;
      });
    });
  }

  async function handleRefreshImages() {
    if (refreshingImages) {
      return;
    }

    setRefreshingImages(true);

    try {
      await refreshImages({ randomizeHero: true });
      setPageError("");
      setImageRefreshVersion((current) => current + 1);
    } catch {
      setPageError("刷新失败，请稍后重试。");
    } finally {
      setRefreshingImages(false);
    }
  }

  async function handleDelete(image: StoredImage) {
    setDeletingId(image.id);

    try {
      const response = await fetch(buildDeleteImagePath(image.id), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("delete failed");
      }

      const payload = (await response.json()) as { images: StoredImage[] };
      setImages(payload.images);
      setHeroImage((current) => {
        if (!current || current.id === image.id) {
          return pickRandomImage(payload.images);
        }

        return current;
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
    const targetUrl = isTouchLikeDevice()
      ? image.originalUrl
      : `${image.originalUrl}?download=1`;

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopyLink(image: StoredImage) {
    const absoluteUrl = new URL(
      image.originalUrl,
      window.location.origin,
    ).toString();

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      playSuccessConfetti("copy");
    } catch {
      window.prompt("复制链接", absoluteUrl);
    }
  }

  function scrollToGallery() {
    galleryRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function scrollToHome() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleGalleryWheel(event: React.WheelEvent<HTMLElement>) {
    if (event.deltaY >= -18 || !galleryRef.current) {
      return;
    }

    const galleryTop =
      galleryRef.current.getBoundingClientRect().top + window.scrollY;
    const isNearGalleryTop = window.scrollY <= galleryTop + 96;

    if (!isNearGalleryTop) {
      return;
    }

    event.preventDefault();

    const now = Date.now();
    if (now - lastAutoScrollAtRef.current < 700) {
      return;
    }

    lastAutoScrollAtRef.current = now;
    scrollToHome();
  }

  function handleHeroWheel(event: React.WheelEvent<HTMLElement>) {
    if (event.deltaY <= 18) {
      return;
    }

    scrollToGallery();
  }

  if (!authorized) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {confettiKind ? (
        <SuccessConfetti
          playToken={confettiToken}
          visible={confettiVisible}
          animationData={
            confettiKind === "upload"
              ? uploadSuccessAnimation
              : copySuccessAnimation
          }
          onComplete={() => {
            setConfettiVisible(false);
            setConfettiKind(null);
          }}
        />
      ) : null}

      <div className="fixed right-4 top-4 z-40 flex items-center gap-2 rounded-full border border-white/14 bg-black/28 p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:right-6 sm:top-6">
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

      <section
        className="relative flex min-h-[100svh] overflow-hidden"
        onWheel={handleHeroWheel}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,0.12),transparent_25%),linear-gradient(135deg,#101216_0%,#0d1117_44%,#050505_100%)]" />
        {heroImage?.mediaType === "video" ? (
          <MediaPreview
            src={withRefreshVersion(heroImage.url, imageRefreshVersion)}
            alt={heroImage.name}
            mediaType={heroImage.mediaType}
            className="absolute inset-0 object-cover"
            showVideoBadge={false}
            videoProps={{
              autoPlay: true,
              loop: true,
              "aria-hidden": true,
            }}
          />
        ) : heroImage ? (
          <MediaPreview
            src={withRefreshVersion(heroImage.url, imageRefreshVersion)}
            alt={heroImage.name}
            mediaType={heroImage.mediaType}
            className="object-cover"
            imageProps={{
              fill: true,
              loading: "eager",
              fetchPriority: "high",
              sizes: "100vw",
              quality: 90,
              transition: {
                overlayClassName: "duration-700",
                imageClassName: "duration-1000 ease-out",
              },
            }}
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.68)_0%,rgba(0,0,0,0.28)_36%,rgba(0,0,0,0.04)_68%,rgba(0,0,0,0.32)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.02)_44%,rgba(0,0,0,0.72)_100%)]" />

        <div className="relative z-20 flex w-full flex-col px-5 pb-52 pt-24 sm:px-8 sm:pb-64 sm:pt-28 lg:px-14">
          <div className="max-w-xl pt-[8vh] sm:pt-[10vh]">
            <h1 className="text-4xl font-semibold leading-none text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:text-6xl lg:text-7xl">
              Native Transfer
            </h1>
            <div className="mt-14">
              <TransferUploadPanel
                onUploaded={refreshImages}
                onUploadSuccess={() => playSuccessConfetti("upload")}
              />
            </div>
            {pageError ? (
              <p className="mt-4 max-w-sm rounded-2xl border border-rose-300/18 bg-rose-950/35 px-4 py-3 text-sm text-rose-100 backdrop-blur-xl">
                {pageError}
              </p>
            ) : null}
          </div>
        </div>

        <GalleryRail
          historyLoading={historyLoading}
          imageRefreshVersion={imageRefreshVersion}
          images={images}
          onOpenImage={setSelectedImage}
          onScrollToGallery={scrollToGallery}
        />
      </section>

      <section
        ref={galleryRef}
        onWheel={handleGalleryWheel}
        className="relative z-10 min-h-screen bg-[#050505] px-4 py-8 sm:px-6 sm:py-10 lg:px-10"
      >
        <div className="mx-auto max-w-[96rem]">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              媒体库
            </h2>
            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs text-white/58">
              {images.length} 个
            </div>
          </div>
          <HistoryPanel
            historyLoading={historyLoading}
            imageRefreshVersion={imageRefreshVersion}
            images={images}
            onOpenImage={setSelectedImage}
          />
        </div>
      </section>

      {selectedImage ? (
        <ImageViewerModal
          key={selectedImage.id}
          deletingId={deletingId}
          imageRefreshVersion={imageRefreshVersion}
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
