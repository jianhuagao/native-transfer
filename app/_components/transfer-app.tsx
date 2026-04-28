"use client";

import { SuccessConfetti } from "@/app/_components/success-confetti";
import { AppHeader } from "@/app/_components/transfer/app-header";
import { HistoryPanel } from "@/app/_components/transfer/history-panel";
import { ImageViewerModal } from "@/app/_components/transfer/image-viewer-modal";
import { LoginScreen } from "@/app/_components/transfer/login-screen";
import { TabSwitcher } from "@/app/_components/transfer/tab-switcher";
import { TransferUploadPanel } from "@/app/_components/transfer/transfer-upload-panel";
import type {
  ConfettiKind,
  StoredImage,
  TabKey,
  TransferAppProps,
} from "@/app/_components/transfer/types";
import {
  buildDeleteImagePath,
  isTouchLikeDevice,
} from "@/app/_components/transfer/utils";
import copySuccessAnimation from "@/public/lotties/confetti-copy-success.json";
import uploadSuccessAnimation from "@/public/lotties/confetti-upload-success.json";
import { startTransition, useEffect, useState } from "react";

export function TransferApp({ initialAuthorized }: TransferAppProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [authNotice, setAuthNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("transfer");
  const [images, setImages] = useState<StoredImage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(initialAuthorized);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [imageRefreshVersion, setImageRefreshVersion] = useState(0);
  const [confettiToken, setConfettiToken] = useState(0);
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [confettiKind, setConfettiKind] = useState<ConfettiKind | null>(null);

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
    setSelectedImage(null);
    setActiveTab("transfer");
  }

  function playSuccessConfetti(kind: ConfettiKind) {
    setConfettiKind(kind);
    setConfettiVisible(true);
    setConfettiToken((current) => current + 1);
  }

  async function refreshImages() {
    const response = await fetch("/api/images", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("refresh failed");
    }

    const payload = (await response.json()) as { images: StoredImage[] };
    startTransition(() => {
      setImages(payload.images);
    });
  }

  async function handleRefreshImages() {
    if (refreshingImages) {
      return;
    }

    setRefreshingImages(true);

    try {
      await refreshImages();
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

  if (!authorized) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(89,168,255,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(237,244,255,0.08),transparent_18%),radial-gradient(circle_at_20%_80%,rgba(50,110,255,0.16),transparent_26%),linear-gradient(180deg,#03060c_0%,#080b12_50%,#020304_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-220 -translate-x-1/2 rounded-full bg-cyan-200/8 blur-3xl" />

      <section className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full flex-col rounded-[32px] border border-white/10 bg-white/6 p-4 shadow-[0_32px_120px_rgba(0,0,0,0.52)] backdrop-blur-3xl sm:min-h-[calc(100vh-3rem)] sm:p-6">
        <AppHeader
          imageCount={images.length}
          refreshingImages={refreshingImages}
          pageError={pageError}
          onRefreshImages={() => void handleRefreshImages()}
          onLogout={() => void handleLogout()}
        />

        <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

        <div className="flex-1">
          {activeTab === "transfer" ? (
            <TransferUploadPanel
              onUploaded={refreshImages}
              onUploadSuccess={() => playSuccessConfetti("upload")}
            />
          ) : (
            <HistoryPanel
              historyLoading={historyLoading}
              imageRefreshVersion={imageRefreshVersion}
              images={images}
              onOpenImage={setSelectedImage}
            />
          )}
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
