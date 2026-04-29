import { HISTORY_GRID_STYLE } from "@/app/_components/transfer/constants";
import { MediaPreview } from "@/app/_components/transfer/media-preview";
import type { StoredImage } from "@/app/_components/transfer/types";

type HistoryPanelProps = {
  historyLoading: boolean;
  images: StoredImage[];
  onOpenImage: (image: StoredImage) => void;
};

export function HistoryPanel({
  historyLoading,
  images,
  onOpenImage,
}: HistoryPanelProps) {
  return (
    <section>
      {historyLoading ? (
        <div className="grid gap-4" style={HISTORY_GRID_STYLE}>
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[0.82] animate-pulse rounded-[22px] border border-white/8 bg-white/7"
            />
          ))}
        </div>
      ) : images.length > 0 ? (
        <div className="grid gap-4 sm:gap-5" style={HISTORY_GRID_STYLE}>
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => onOpenImage(image)}
              className="group overflow-hidden rounded-[22px] border border-white/10 bg-white/6 text-left shadow-[0_18px_54px_rgba(0,0,0,0.28)] transition duration-500 ease-out hover:-translate-y-1 hover:border-white/34 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
            >
              <div className="relative aspect-[0.82] overflow-hidden">
                <MediaPreview
                  src={image.url}
                  alt={image.name}
                  mediaType={image.mediaType}
                  className="object-cover transition duration-700 group-hover:scale-105"
                  imageProps={{
                    fill: true,
                    sizes:
                      "(max-width: 640px) 50vw, (max-width: 960px) 33vw, (max-width: 1280px) 25vw, (max-width: 1680px) 20vw, 16vw",
                    quality: 70,
                    decoding: "async",
                  }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.10)_56%,rgba(0,0,0,0.54)_100%)]" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-[24px] border border-dashed border-white/14 bg-white/6 px-6 text-center">
          <h3 className="text-xl font-medium text-white">暂无媒体</h3>
        </div>
      )}
    </section>
  );
}
