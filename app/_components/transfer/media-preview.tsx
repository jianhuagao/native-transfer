"use client";

import { PlayIcon } from "@heroicons/react/24/solid";
import type { MediaKind } from "@/app/_lib/media";
import { ProgressiveImage } from "@/app/_components/transfer/progressive-image";
import type { ComponentProps, VideoHTMLAttributes } from "react";

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

export function MediaPreview({
  alt,
  className,
  imageProps,
  mediaType,
  showVideoBadge = true,
  src,
  videoProps,
}: MediaPreviewProps) {
  if (mediaType === "video") {
    return (
      <>
        <video
          {...videoProps}
          aria-label={alt}
          className={`h-full w-full ${className ?? ""} bg-black`}
          muted={videoProps?.muted ?? true}
          playsInline={videoProps?.playsInline ?? true}
          preload={videoProps?.preload ?? "metadata"}
          src={src}
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
