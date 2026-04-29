"use client";

import { PlayIcon } from "@heroicons/react/24/solid";
import type { MediaKind } from "@/app/_lib/media";
import { ProgressiveImage } from "@/app/_components/transfer/progressive-image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type VideoHTMLAttributes,
} from "react";

type MediaPreviewProps = {
  alt: string;
  className?: string;
  imageProps?: Omit<
    ComponentProps<typeof ProgressiveImage>,
    "alt" | "className" | "src"
  >;
  mediaType: MediaKind;
  showVideoBadge?: boolean;
  src: string;
  videoProps?: Omit<
    VideoHTMLAttributes<HTMLVideoElement>,
    "className" | "src"
  >;
};

function withVideoFirstFrameHint(src: string) {
  if (src.includes("#")) {
    return src;
  }

  return `${src}#t=0.001`;
}

function useVideoInViewLoad() {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [canLoad, setCanLoad] = useState(false);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const videoRef = useCallback(
    (video: HTMLVideoElement | null) => {
      observerRef.current?.disconnect();

      if (!video || canLoad) {
        return;
      }

      if (!("IntersectionObserver" in window)) {
        setCanLoad(true);
        return;
      }

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) {
            return;
          }

          setCanLoad(true);
          observerRef.current?.disconnect();
        },
        { rootMargin: "480px 0px" },
      );

      observerRef.current.observe(video);
    },
    [canLoad],
  );

  return { canLoad, videoRef };
}

export function MediaPreview({
  alt,
  className,
  imageProps,
  mediaType,
  showVideoBadge = true,
  src,
  videoProps,
}: MediaPreviewProps) {
  const autoPlay = videoProps?.autoPlay ?? false;
  const { canLoad: canLoadVideo, videoRef } = useVideoInViewLoad();
  const shouldLoadVideo = autoPlay || canLoadVideo;

  if (mediaType === "video") {
    return (
      <>
        <video
          {...videoProps}
          ref={videoRef}
          aria-label={alt}
          className={`h-full w-full ${className ?? ""} bg-black`}
          muted={videoProps?.muted ?? true}
          playsInline={videoProps?.playsInline ?? true}
          preload={
            shouldLoadVideo ? (videoProps?.preload ?? "metadata") : "none"
          }
          src={
            shouldLoadVideo
              ? autoPlay
                ? src
                : withVideoFirstFrameHint(src)
              : undefined
          }
        />
        {showVideoBadge ? (
          <span className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/42 text-white shadow-[0_10px_30px_rgba(0,0,0,0.34)] backdrop-blur-md">
            <PlayIcon className="ml-0.5 size-4" />
          </span>
        ) : null}
      </>
    );
  }

  return (
    <ProgressiveImage
      {...imageProps}
      alt={alt}
      className={className}
      src={src}
    />
  );
}
