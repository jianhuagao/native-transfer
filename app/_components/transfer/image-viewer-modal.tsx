"use client";

import {
  ArrowDownOnSquareIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LinkIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import type { StoredImage } from "@/app/_components/transfer/types";
import {
  formatFileSize,
  withRefreshVersion,
} from "@/app/_components/transfer/utils";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useEffect, useRef, useState } from "react";

type ImageViewerModalProps = {
  deletingId: string | null;
  imageRefreshVersion: number;
  images: StoredImage[];
  selectedImage: StoredImage;
  onClose: () => void;
  onCopyLink: (image: StoredImage) => Promise<void>;
  onDelete: (image: StoredImage) => Promise<void>;
  onDownload: (image: StoredImage) => void;
  onSelectImage: (image: StoredImage) => void;
};

export function ImageViewerModal({
  deletingId,
  imageRefreshVersion,
  images,
  selectedImage,
  onClose,
  onCopyLink,
  onDelete,
  onDownload,
  onSelectImage,
}: ImageViewerModalProps) {
  const imageViewerRef = useRef<ReactZoomPanPinchRef | null>(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const [selectedImageLoading, setSelectedImageLoading] = useState(true);
  const [previewUseOriginal, setPreviewUseOriginal] = useState(false);

  const selectedImageIndex = images.findIndex(
    (image) => image.id === selectedImage.id,
  );
  const previousImage =
    selectedImageIndex > 0 ? images[selectedImageIndex - 1] : null;
  const nextImage =
    selectedImageIndex >= 0 && selectedImageIndex < images.length - 1
      ? images[selectedImageIndex + 1]
      : null;

  function resetSelectedImageView() {
    setPreviewRotation(0);
    setPreviewScale(1);
    imageViewerRef.current?.resetTransform(0);
    imageViewerRef.current?.centerView(1, 0);
  }

  function showSelectedImageOriginal() {
    setSelectedImageLoading(true);
    setPreviewUseOriginal(true);
    imageViewerRef.current?.resetTransform(0);
    imageViewerRef.current?.centerView(1, 0);
  }

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft" && previousImage) {
        onSelectImage(previousImage);
      }

      if (event.key === "ArrowRight" && nextImage) {
        onSelectImage(nextImage);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [nextImage, onClose, onSelectImage, previousImage]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-0 backdrop-blur-xl sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative h-dvh w-full overflow-hidden bg-[#03060c]/96 shadow-[0_30px_120px_rgba(0,0,0,0.7)] sm:h-[94dvh] sm:max-w-[min(96vw,1600px)] sm:rounded-[28px] sm:border sm:border-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 bg-[linear-gradient(180deg,rgba(0,0,0,0.6),rgba(0,0,0,0))] p-4 sm:p-5">
          <div className="min-w-0 rounded-full border border-white/10 bg-black/30 px-3 py-2 pr-4 backdrop-blur-md">
            <div className="truncate text-sm font-medium text-white">
              {selectedImage.name}
            </div>
            <div className="mt-1 text-xs text-white/55">
              {selectedImage.uploadedAtLabel} ·{" "}
              {formatFileSize(selectedImage.size)}
            </div>
          </div>
          <div className="pointer-events-auto shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-black/36 p-2 text-sm text-white/82 backdrop-blur-md transition hover:bg-black/52"
            >
              <XMarkIcon className="size-6 font-bold text-white" />
            </button>
          </div>
        </div>

        <div className="relative h-full w-full overflow-hidden">
          {selectedImageLoading ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full border border-white/10 bg-black/28 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/18 border-t-cyan-200/90" />
              </div>
            </div>
          ) : null}
          <TransformWrapper
            ref={imageViewerRef}
            initialScale={1}
            minScale={1}
            maxScale={6}
            smooth={false}
            centerOnInit
            centerZoomedOut
            doubleClick={{ mode: "zoomIn", step: 1.5 }}
            pinch={{ step: 5 }}
            wheel={{ step: 0.2 }}
            panning={{ allowLeftClickPan: true }}
            onInit={(ref) => {
              imageViewerRef.current = ref;
            }}
            onTransform={(_, state) => {
              setPreviewScale(state.scale);
            }}
          >
            <TransformComponent
              wrapperClass="!h-full !w-full"
              contentClass="!h-full !w-full"
              wrapperStyle={{
                width: "100%",
                height: "100%",
              }}
              contentStyle={{
                width: "100%",
                height: "100%",
              }}
            >
              <div className="flex h-full w-full items-center justify-center p-4 pt-24 pb-16 sm:p-8 sm:pt-24 sm:pb-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    previewUseOriginal
                      ? selectedImage.originalUrl
                      : withRefreshVersion(
                          selectedImage.url,
                          imageRefreshVersion,
                        )
                  }
                  alt={selectedImage.name}
                  onLoad={() => setSelectedImageLoading(false)}
                  onError={() => setSelectedImageLoading(false)}
                  draggable={false}
                  className="max-h-full max-w-full select-none object-contain transition-transform duration-200 ease-out"
                  style={{
                    transform: `rotate(${previewRotation}deg)`,
                    transformOrigin: "center center",
                  }}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-full max-w-[calc(100%-1.5rem)] -translate-x-1/2 px-3 sm:bottom-5 sm:max-w-max sm:px-0">
          <div className="pointer-events-auto mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-[20px] border border-white/10 bg-black/34 px-2.5 py-2 shadow-[0_18px_40px_rgba(0,0,0,0.24)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => previousImage && onSelectImage(previousImage)}
              disabled={!previousImage}
              title="上一张"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeftIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => nextImage && onSelectImage(nextImage)}
              disabled={!nextImage}
              title="下一张"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronRightIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => imageViewerRef.current?.zoomOut(0.2)}
              title="缩小"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <MagnifyingGlassMinusIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => imageViewerRef.current?.zoomIn(0.2)}
              title="放大"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <MagnifyingGlassPlusIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewRotation((current) => current - 90)}
              title="左转"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <ArrowUturnLeftIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewRotation((current) => current + 90)}
              title="右转"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <ArrowUturnRightIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={resetSelectedImageView}
              title="复位"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <ArrowPathIcon className="size-4.5 text-white" />
            </button>
            <div className="inline-flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold tracking-[0.04em] text-white/62">
              {previewScale.toFixed(2)}x
            </div>
            <button
              type="button"
              onClick={showSelectedImageOriginal}
              disabled={previewUseOriginal}
              title="原图"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <PhotoIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => void onCopyLink(selectedImage)}
              title="复制链接"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <LinkIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              onClick={() => onDownload(selectedImage)}
              title="下载"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/82 transition hover:bg-white/10"
            >
              <ArrowDownOnSquareIcon className="size-4.5 text-white" />
            </button>
            <button
              type="button"
              disabled={deletingId === selectedImage.id}
              onClick={() => void onDelete(selectedImage)}
              title={deletingId === selectedImage.id ? "删除中" : "删除"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-100 transition hover:bg-rose-400/14 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {deletingId === selectedImage.id ? (
                <ArrowPathIcon className="size-4.5 animate-spin" />
              ) : (
                <TrashIcon className="size-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
