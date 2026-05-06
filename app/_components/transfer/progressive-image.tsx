"use client";

import { IMAGE_PLACEHOLDER } from "@/app/_components/transfer/constants";
import Image, { type StaticImageData } from "next/image";
import { useState, type ComponentProps } from "react";

type ProgressiveImageProps = ComponentProps<typeof Image>;
type ProgressiveImageTransition = {
  overlayClassName?: string;
  imageClassName?: string;
};
type ProgressiveImageLoadingIndicator = {
  enabled?: boolean;
  sizeClassName?: string;
};
type ProgressiveImageLoadingEffect = "blur" | "fade";

function getImageSrcValue(src: ProgressiveImageProps["src"]) {
  if (typeof src === "string") {
    return src;
  }

  if ("default" in src) {
    return src.default.src;
  }

  return (src as StaticImageData).src;
}

export function ProgressiveImage({
  alt,
  className,
  loading = "lazy",
  onLoad,
  placeholder = IMAGE_PLACEHOLDER,
  src,
  loadingIndicator,
  loadingEffect = "blur",
  transition,
  ...props
}: ProgressiveImageProps & {
  loadingIndicator?: ProgressiveImageLoadingIndicator;
  loadingEffect?: ProgressiveImageLoadingEffect;
  transition?: ProgressiveImageTransition;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const currentSrc = getImageSrcValue(src);
  const loaded = loadedSrc === currentSrc;
  const overlayTransitionClassName =
    transition?.overlayClassName ?? "duration-500";
  const imageTransitionClassName =
    transition?.imageClassName ?? "duration-700 ease-out";
  const loadingIndicatorSizeClassName =
    loadingIndicator?.sizeClassName ?? "h-11 w-11";

  return (
    <>
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),rgba(255,255,255,0.03)_48%,rgba(0,0,0,0.24))] transition ${overlayTransitionClassName} ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      {loadingIndicator?.enabled ? (
        <div
          className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition duration-300 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="rounded-full border border-white/10 bg-black/28 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div
              className={`${loadingIndicatorSizeClassName} animate-spin rounded-full border-2 border-white/18 border-t-cyan-200/90`}
            />
          </div>
        </div>
      ) : null}
      <Image
        {...props}
        alt={alt}
        loading={loading}
        placeholder={placeholder}
        src={src}
        onLoad={(event) => {
          setLoadedSrc(currentSrc);
          onLoad?.(event);
        }}
        className={`${className ?? ""} transition ${imageTransitionClassName} ${
          loaded
            ? "scale-100 opacity-100 blur-0"
            : loadingEffect === "blur"
              ? "scale-[1.02] opacity-100 blur-xl"
              : "scale-[1.01] opacity-100 blur-0"
        }`}
      />
    </>
  );
}
