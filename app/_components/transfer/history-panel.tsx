import { HISTORY_GRID_STYLE } from "@/app/_components/transfer/constants";
import { ProgressiveImage } from "@/app/_components/transfer/progressive-image";
import type { StoredImage } from "@/app/_components/transfer/types";
import { withRefreshVersion } from "@/app/_components/transfer/utils";

type HistoryPanelProps = {
  historyLoading: boolean;
  imageRefreshVersion: number;
  images: StoredImage[];
  onOpenImage: (image: StoredImage) => void;
};

export function HistoryPanel({
  historyLoading,
  imageRefreshVersion,
  images,
  onOpenImage,
}: HistoryPanelProps) {
  return (
    <section>
      <article className="rounded-[28px] p-0 sm:border sm:border-white/10 sm:bg-white/6 sm:p-5">
        {historyLoading ? (
          <div className="grid gap-4" style={HISTORY_GRID_STYLE}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[0.82] animate-pulse rounded-3xl border border-white/8 bg-white/7"
              />
            ))}
          </div>
        ) : images.length > 0 ? (
          <div className="grid gap-4" style={HISTORY_GRID_STYLE}>
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onOpenImage(image)}
                className="group overflow-hidden rounded-3xl border border-white/10 bg-black/18 text-left transition hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="relative aspect-[0.82] overflow-hidden">
                  <ProgressiveImage
                    src={withRefreshVersion(image.url, imageRefreshVersion)}
                    alt={image.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, (max-width: 1280px) 33vw, (max-width: 1680px) 25vw, 20vw"
                    quality={70}
                    decoding="async"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.14)_55%,rgba(0,0,0,0.72)_100%)]" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <div className="line-clamp-1 text-sm text-white/90">
                      {image.name}
                    </div>
                    <div className="mt-1 text-xs text-white/55">
                      {image.uploadedAtLabel}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-black/18 px-6 text-center">
            <h3 className="text-xl font-medium text-white">暂无图片</h3>
          </div>
        )}
      </article>
    </section>
  );
}
