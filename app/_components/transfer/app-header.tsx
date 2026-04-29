import { ArrowPathIcon, PowerIcon } from "@heroicons/react/24/solid";

type AppHeaderProps = {
  mediaCount: number;
  refreshingImages: boolean;
  pageError: string;
  onRefreshImages: () => void;
  onLogout: () => void;
};

export function AppHeader({
  mediaCount,
  refreshingImages,
  pageError,
  onRefreshImages,
  onLogout,
}: AppHeaderProps) {
  return (
    <>
      <header className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tighter text-white sm:text-3xl">
            Native Transfer
          </h1>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/45">
            已保存 {mediaCount} 个
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefreshImages}
            disabled={refreshingImages}
            title={refreshingImages ? "刷新中" : "刷新"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/75 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {/* <svg
              viewBox="0 0 24 24"
              className={`size-4.5 ${refreshingImages ? "animate-spin" : ""}`}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 4a8 8 0 0 1 7.75 6h-2.22A6 6 0 1 0 18 13h2a8 8 0 1 1-8-9Zm.5 1.5V1L18 6.5 12.5 12V7.5A4.5 4.5 0 1 0 17 12h2a6.5 6.5 0 1 1-6.5-6.5Z" />
            </svg> */}
            <ArrowPathIcon
              className={`size-4.5 ${refreshingImages ? "animate-spin" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/75 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PowerIcon className="size-4" />
          </button>
        </div>
      </header>

      {pageError ? (
        <p className="mb-4 text-center text-sm text-rose-300">{pageError}</p>
      ) : null}
    </>
  );
}
