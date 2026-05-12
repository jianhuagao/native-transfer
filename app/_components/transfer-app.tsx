"use client";

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
  ArrowDownOnSquareIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  CheckIcon,
  CircleStackIcon,
  EyeIcon,
  LinkIcon,
  PhotoIcon,
  PowerIcon,
  QrCodeIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import dynamic from "next/dynamic";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ImageViewerModal = dynamic(
  () =>
    import("@/app/_components/transfer/image-viewer-modal").then(
      (module) => module.ImageViewerModal,
    ),
  { ssr: false },
);

const SourceTransferModal = dynamic(
  () =>
    import("@/app/_components/transfer/source-transfer-modal").then(
      (module) => module.SourceTransferModal,
    ),
  { ssr: false },
);

const EMPTY_STORAGE_USAGE: StorageUsage = {
  totalBytes: 0,
  usedBytes: 0,
  percent: 0,
};
const DEFAULT_UPLOAD_MODE = "form-data";
const HERO_SWITCH_DELAY_MS = 400;
const HERO_TRANSITION_MS = 600;
const HERO_PREVIOUS_RETENTION_MS = 1900;
const IMAGES_PAGE_SIZE = 60;
const MEDIA_GRID_STYLE = {
  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 13rem), 1fr))",
};
const MEDIA_TILE_IMAGE_SIZES =
  "(max-width: 640px) 50vw, (max-width: 960px) 33vw, (max-width: 1280px) 25vw, (max-width: 1680px) 20vw, 16vw";
const MEDIA_TILE_PRELOAD_MARGIN = "0px 0px 160px 0px";
const QUICK_ACTION_PRESS_MS = 420;
const QUICK_DELETE_CONFIRM_MS = 2400;
const COPY_FEEDBACK_MS = 1400;
const DEFAULT_PREVIEW_TITLE = "Native Transfer";
const DEFAULT_SHARE_UPLOAD_OPTIONS = {
  allowVideo: false,
  expiresInMinutes: 10,
  maxFiles: 10,
};
const PREVIEW_CONFIG_STORAGE_KEY = "native-transfer-preview-config:v1";
const PREVIEW_TITLE_BASE_CLASS =
  "text-4xl font-semibold leading-none text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:text-6xl lg:text-7xl";
const PREVIEW_TITLE_COLORS = [
  { label: "白", value: "#ffffff" },
  { label: "暖白", value: "#fff2dc" },
  { label: "湖蓝", value: "#bdefff" },
  { label: "金色", value: "#ffe08a" },
  { label: "粉色", value: "#ffd1dc" },
  { label: "墨色", value: "#111827" },
];
const PREVIEW_TITLE_FONT_SCALES = [
  { label: "小", value: 0.86 },
  { label: "默认", value: 1 },
  { label: "大", value: 1.14 },
  { label: "特大", value: 1.3 },
];
const PREVIEW_TITLE_SHADOW_LEVELS = [
  { label: "无", value: 0 },
  { label: "轻", value: 1 },
  { label: "默认", value: 2 },
  { label: "强", value: 3 },
];

type HeroBackdropState = {
  current: StoredImage | null;
  previous: StoredImage | null;
  ready: boolean;
  version: number;
};

type PreviewTitleStyle = {
  color: string;
  fontScale: number;
  shadowLevel: number;
  x: number;
  y: number;
};

type PreviewConfig = {
  backgroundKey: string;
  enabled: boolean;
  pinnedKeys: string[];
  showUnpinned: boolean;
  title: string;
  titleStyle: PreviewTitleStyle;
};

type ShareUploadOptions = typeof DEFAULT_SHARE_UPLOAD_OPTIONS;

type ShareUploadPayload = {
  expiresAt: number;
  maxFiles: number;
  sourceLabel: string;
  token: string;
  url: string;
};

const DEFAULT_PREVIEW_TITLE_STYLE: PreviewTitleStyle = {
  color: "#ffffff",
  fontScale: 1,
  shadowLevel: 2,
  x: 0,
  y: 0,
};

const DEFAULT_PREVIEW_CONFIG: PreviewConfig = {
  backgroundKey: "",
  enabled: false,
  pinnedKeys: [],
  showUnpinned: true,
  title: DEFAULT_PREVIEW_TITLE,
  titleStyle: DEFAULT_PREVIEW_TITLE_STYLE,
};

function pickLatestHeroImage(images: StoredImage[]) {
  return images.find((image) => image.mediaType === "image") ?? null;
}

function getImageIdentity(image: StoredImage | null) {
  return image ? `${image.sourceId}:${image.id}` : "";
}

function getStoredImageKey(image: StoredImage) {
  return `${image.sourceId}:${image.id}`;
}

function sanitizePreviewTitleStyle(
  titleStyle: Partial<PreviewTitleStyle> | undefined,
) {
  const color =
    typeof titleStyle?.color === "string" &&
    PREVIEW_TITLE_COLORS.some((item) => item.value === titleStyle.color)
      ? titleStyle.color
      : DEFAULT_PREVIEW_TITLE_STYLE.color;
  const fontScale =
    typeof titleStyle?.fontScale === "number" &&
    Number.isFinite(titleStyle.fontScale)
      ? Math.min(1.6, Math.max(0.72, titleStyle.fontScale))
      : DEFAULT_PREVIEW_TITLE_STYLE.fontScale;
  const shadowLevel =
    typeof titleStyle?.shadowLevel === "number" &&
    Number.isFinite(titleStyle.shadowLevel)
      ? Math.min(3, Math.max(0, Math.round(titleStyle.shadowLevel)))
      : DEFAULT_PREVIEW_TITLE_STYLE.shadowLevel;
  const x =
    typeof titleStyle?.x === "number" && Number.isFinite(titleStyle.x)
      ? titleStyle.x
      : DEFAULT_PREVIEW_TITLE_STYLE.x;
  const y =
    typeof titleStyle?.y === "number" && Number.isFinite(titleStyle.y)
      ? titleStyle.y
      : DEFAULT_PREVIEW_TITLE_STYLE.y;

  return {
    color,
    fontScale,
    shadowLevel,
    x,
    y,
  };
}

function getPreviewTitleFilter(shadowLevel: number) {
  if (shadowLevel <= 0) {
    return "none";
  }

  if (shadowLevel === 1) {
    return "drop-shadow(0 6px 16px rgba(0,0,0,0.36))";
  }

  if (shadowLevel >= 3) {
    return "drop-shadow(0 14px 42px rgba(0,0,0,0.68))";
  }

  return "drop-shadow(0 10px 30px rgba(0,0,0,0.5))";
}

function loadPreviewConfig() {
  if (typeof window === "undefined") {
    return DEFAULT_PREVIEW_CONFIG;
  }

  try {
    const storedConfig = window.localStorage.getItem(PREVIEW_CONFIG_STORAGE_KEY);

    if (!storedConfig) {
      return DEFAULT_PREVIEW_CONFIG;
    }

    const parsed = JSON.parse(storedConfig) as Partial<PreviewConfig>;

    return {
      backgroundKey:
        typeof parsed.backgroundKey === "string" ? parsed.backgroundKey : "",
      enabled: parsed.enabled === true,
      pinnedKeys: Array.isArray(parsed.pinnedKeys)
        ? parsed.pinnedKeys.filter((key) => typeof key === "string")
        : [],
      showUnpinned: parsed.showUnpinned !== false,
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : DEFAULT_PREVIEW_TITLE,
      titleStyle: sanitizePreviewTitleStyle(parsed.titleStyle),
    };
  } catch {
    return DEFAULT_PREVIEW_CONFIG;
  }
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

function removeImageFromUsage(usage: StorageUsage, image: StoredImage) {
  const usedBytes = Math.max(0, usage.usedBytes - image.size);
  const percent =
    usage.totalBytes > 0
      ? Math.min(100, (usedBytes / usage.totalBytes) * 100)
      : 0;

  return {
    ...usage,
    usedBytes,
    percent,
  };
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
      <div className="min-w-0 flex-1 sm:min-w-29">
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
        className="min-w-0 max-w-full bg-transparent text-sm font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-55 sm:max-w-36"
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

function PreviewSettingsDialog({
  backgroundSelected,
  pinnedCount,
  showUnpinned,
  title,
  titleStyle,
  onClearBackground,
  onClearPinned,
  onClose,
  onExitPreview,
  onSaveTitle,
  onSetShowUnpinned,
  onUpdateTitleStyle,
}: {
  backgroundSelected: boolean;
  pinnedCount: number;
  showUnpinned: boolean;
  title: string;
  titleStyle: PreviewTitleStyle;
  onClearBackground: () => void;
  onClearPinned: () => void;
  onClose: () => void;
  onExitPreview: () => void;
  onSaveTitle: (title: string) => void;
  onSetShowUnpinned: (showUnpinned: boolean) => void;
  onUpdateTitleStyle: (titleStyle: Partial<PreviewTitleStyle>) => void;
}) {
  const [draftTitle, setDraftTitle] = useState(title);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaveTitle(draftTitle.trim() || DEFAULT_PREVIEW_TITLE);
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="预览模式设置"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[26px] border border-white/12 bg-[#080b12]/96 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">预览模式</h2>
            <p className="mt-1 text-sm text-white/52">
              调整展示标题、置顶范围和标题样式。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/68 transition hover:bg-white/10 hover:text-white"
            aria-label="关闭"
            title="关闭"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-white/48">
              展示标题
            </span>
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-black/28 px-3 text-sm font-medium text-white outline-none transition placeholder:text-white/28 focus:border-cyan-200/48"
              placeholder="例如：成都之旅"
            />
          </label>

          <button
            type="button"
            onClick={() => onSetShowUnpinned(!showUnpinned)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/7 px-3 py-3 text-left transition hover:bg-white/12"
          >
            <span>
              <span className="block text-sm font-medium text-white">
                显示非置顶照片
              </span>
              <span className="mt-1 block text-xs text-white/45">
                开启后，置顶照片优先显示，其余照片继续跟在后面。
              </span>
            </span>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
                showUnpinned
                  ? "border-cyan-100/36 bg-cyan-100/28"
                  : "border-white/12 bg-black/32"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-1 size-4 rounded-full bg-white transition ${
                  showUnpinned ? "left-6" : "left-1"
                }`}
              />
            </span>
          </button>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/6 p-3">
            <div>
              <span className="block text-xs font-medium text-white/48">
                标题颜色
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {PREVIEW_TITLE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => onUpdateTitleStyle({ color: color.value })}
                    className={`size-8 rounded-full border transition ${
                      titleStyle.color === color.value
                        ? "border-white ring-2 ring-white/28"
                        : "border-white/18 hover:border-white/55"
                    }`}
                    style={{ backgroundColor: color.value }}
                    aria-label={`标题颜色：${color.label}`}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-white/48">
                字体大小
              </span>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {PREVIEW_TITLE_FONT_SCALES.map((scale) => (
                  <button
                    key={scale.value}
                    type="button"
                    onClick={() =>
                      onUpdateTitleStyle({ fontScale: scale.value })
                    }
                    className={`h-9 rounded-full border text-xs font-medium transition ${
                      titleStyle.fontScale === scale.value
                        ? "border-white/72 bg-white text-slate-950"
                        : "border-white/10 bg-black/22 text-white/66 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {scale.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-white/48">
                阴影大小
              </span>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {PREVIEW_TITLE_SHADOW_LEVELS.map((shadow) => (
                  <button
                    key={shadow.value}
                    type="button"
                    onClick={() =>
                      onUpdateTitleStyle({ shadowLevel: shadow.value })
                    }
                    className={`h-9 rounded-full border text-xs font-medium transition ${
                      titleStyle.shadowLevel === shadow.value
                        ? "border-white/72 bg-white text-slate-950"
                        : "border-white/10 bg-black/22 text-white/66 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {shadow.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onUpdateTitleStyle({ x: 0, y: 0 })}
              disabled={titleStyle.x === 0 && titleStyle.y === 0}
              className="h-9 w-full rounded-full border border-white/10 bg-black/20 text-xs font-medium text-white/66 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              重置标题位置
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClearPinned}
              disabled={pinnedCount === 0}
              className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3 text-left text-sm text-white/72 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="block font-medium text-white">清空置顶</span>
              <span className="mt-1 block text-xs text-white/45">
                已置顶 {pinnedCount} 张
              </span>
            </button>
            <button
              type="button"
              onClick={onClearBackground}
              disabled={!backgroundSelected}
              className="rounded-2xl border border-white/10 bg-white/7 px-3 py-3 text-left text-sm text-white/72 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="block font-medium text-white">取消背景</span>
              <span className="mt-1 block text-xs text-white/45">
                {backgroundSelected ? "已设置背景" : "未设置背景"}
              </span>
            </button>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <button
              type="submit"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105"
            >
              保存标题
            </button>
            <button
              type="button"
              onClick={onExitPreview}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-white/12 bg-white/7 px-4 text-sm font-semibold text-white/78 transition hover:bg-white/12 hover:text-white"
            >
              退出预览模式
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ShareUploadDialog({
  draft,
  error,
  loading,
  payload,
  onClose,
  onCopyLink,
  onRegenerate,
  onUpdateDraft,
}: {
  draft: ShareUploadOptions;
  error: string;
  loading: boolean;
  payload: ShareUploadPayload | null;
  onClose: () => void;
  onCopyLink: () => void;
  onRegenerate: () => void;
  onUpdateDraft: (draft: ShareUploadOptions) => void;
}) {
  const expiresAtLabel = payload
    ? new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(payload.expiresAt))
    : "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onRegenerate();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 p-4 backdrop-blur-xl"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="分享上传二维码"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[26px] border border-white/12 bg-[#080b12]/96 p-4 shadow-[0_30px_100px_rgba(0,0,0,0.62)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">扫码上传</h2>
            <p className="mt-1 text-sm text-white/52">
              {payload
                ? `${payload.sourceLabel} · 有效至 ${expiresAtLabel} · 最多 ${payload.maxFiles} 张`
                : "正在生成二维码"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/68 transition hover:bg-white/10 hover:text-white"
            aria-label="关闭"
            title="关闭"
          >
            <XMarkIcon className="size-5" />
          </button>
        </div>

        <div className="mt-5 flex min-h-72 items-center justify-center rounded-3xl border border-white/10 bg-white p-4">
          {payload ? (
            <QRCodeSVG value={payload.url} size={248} marginSize={2} />
          ) : (
            <ArrowPathIcon className="size-7 animate-spin text-slate-950" />
          )}
        </div>

        {error ? (
          <p className="mt-3 rounded-2xl border border-rose-300/18 bg-rose-950/35 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCopyLink}
            disabled={!payload}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/12 bg-white/7 px-3 text-sm font-medium text-white/74 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <LinkIcon className="mr-1.5 size-4" />
            复制链接
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-full bg-white px-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
          >
            <ArrowPathIcon
              className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`}
            />
            重新生成
          </button>
        </div>

        <details className="mt-3 rounded-2xl border border-white/10 bg-white/6 p-3">
          <summary className="cursor-pointer text-sm font-medium text-white/78">
            高级
          </summary>
          <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/48">
                生效时间（分钟）
              </span>
              <input
                type="number"
                min={1}
                max={1440}
                value={draft.expiresInMinutes}
                onChange={(event) =>
                  onUpdateDraft({
                    ...draft,
                    expiresInMinutes: Number(event.target.value),
                  })
                }
                className="h-10 w-full rounded-2xl border border-white/10 bg-black/28 px-3 text-sm font-medium text-white outline-none transition focus:border-cyan-200/48"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/48">
                上传图片限制
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={draft.maxFiles}
                onChange={(event) =>
                  onUpdateDraft({
                    ...draft,
                    maxFiles: Number(event.target.value),
                  })
                }
                className="h-10 w-full rounded-2xl border border-white/10 bg-black/28 px-3 text-sm font-medium text-white outline-none transition focus:border-cyan-200/48"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                onUpdateDraft({ ...draft, allowVideo: !draft.allowVideo })
              }
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:bg-white/10"
            >
              <span className="text-sm font-medium text-white/78">
                允许上传视频
              </span>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
                  draft.allowVideo
                    ? "border-cyan-100/36 bg-cyan-100/28"
                    : "border-white/12 bg-black/32"
                }`}
                aria-hidden
              >
                <span
                  className={`absolute top-1 size-4 rounded-full bg-white transition ${
                    draft.allowVideo ? "left-6" : "left-1"
                  }`}
                />
              </span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
            >
              应用并重新生成
            </button>
          </form>
        </details>
      </section>
    </div>
  );
}

function useInViewOnce<TElement extends Element>(
  rootMargin = MEDIA_TILE_PRELOAD_MARGIN,
) {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const elementRef = useCallback(
    (element: TElement | null) => {
      observerRef.current?.disconnect();

      if (!element || inView) {
        return;
      }

      if (!("IntersectionObserver" in window)) {
        setInView(true);
        return;
      }

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting) {
            return;
          }

          setInView(true);
          observerRef.current?.disconnect();
        },
        { rootMargin, threshold: 0.01 },
      );
      observerRef.current.observe(element);
    },
    [inView, rootMargin],
  );

  return { elementRef, inView };
}

const MediaTile = memo(function MediaTile({
  active,
  backgroundSelected,
  copied,
  deleteConfirming,
  deleting,
  image,
  onActivateActions,
  onClearActions,
  onCopyImage,
  onDeleteImage,
  onDownloadImage,
  onOpenImage,
  onSetPreviewBackground,
  onTogglePreviewPin,
  pinned,
  previewMode,
}: {
  active: boolean;
  backgroundSelected: boolean;
  copied: boolean;
  deleteConfirming: boolean;
  deleting: boolean;
  image: StoredImage;
  onActivateActions: (image: StoredImage) => void;
  onClearActions: () => void;
  onCopyImage: (image: StoredImage) => void;
  onDeleteImage: (image: StoredImage) => void;
  onDownloadImage: (image: StoredImage) => void;
  onOpenImage: (image: StoredImage) => void;
  onSetPreviewBackground: (image: StoredImage) => void;
  onTogglePreviewPin: (image: StoredImage) => void;
  pinned: boolean;
  previewMode: boolean;
}) {
  const { elementRef, inView } = useInViewOnce<HTMLDivElement>();
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current === null) {
      return;
    }

    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onActivateActions(image);
      longPressTimerRef.current = null;

      if ("vibrate" in navigator) {
        navigator.vibrate(8);
      }
    }, QUICK_ACTION_PRESS_MS);
  }

  function runQuickAction(
    event: React.MouseEvent<HTMLButtonElement>,
    action: (image: StoredImage) => void,
  ) {
    event.preventDefault();
    event.stopPropagation();
    clearLongPressTimer();
    action(image);
  }

  useEffect(() => clearLongPressTimer, []);

  return (
    <div
      ref={elementRef}
      className={`group relative aspect-[1.58] select-none overflow-hidden rounded-[22px] border bg-black/30 text-left shadow-[0_16px_42px_rgba(0,0,0,0.32)] [-webkit-touch-callout:none] [-webkit-user-select:none] [touch-action:manipulation] transition duration-300 hover:-translate-y-1 ${
        active
          ? "border-cyan-100/74 ring-2 ring-cyan-100/24"
          : "border-white/12 hover:border-white/42"
      }`}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_50%,rgba(0,0,0,0.18))]" />
      <button
        type="button"
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            longPressTriggeredRef.current = false;
            return;
          }

          onClearActions();
          onOpenImage(image);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onPointerLeave={clearLongPressTimer}
        onContextMenu={(event) => {
          if (isTouchLikeDevice()) {
            event.preventDefault();
            onActivateActions(image);
          }
        }}
        aria-label={`打开 ${image.name}`}
        className="absolute inset-0 select-none focus-visible:outline focus-visible:outline-white/70"
      >
        {inView ? (
          image.mediaType === "image" ? (
            <Image
              src={image.thumbnailUrl ?? image.url}
              alt={image.name}
              fill
              loading="lazy"
              sizes={MEDIA_TILE_IMAGE_SIZES}
              quality={70}
              decoding="async"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <MediaPreview
              src={image.thumbnailUrl ?? image.url}
              alt={image.name}
              mediaType={image.mediaType}
              className="object-cover transition duration-500 group-hover:scale-105"
            />
          )
        ) : null}
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.36))]" />
      </button>

      <div
        className={`absolute inset-x-2 top-2 flex items-center justify-start gap-1 transition duration-200 ${
          active
            ? "opacity-100"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
        }`}
      >
        {previewMode ? (
          <>
            <button
              type="button"
              onClick={(event) => runQuickAction(event, onTogglePreviewPin)}
              title={pinned ? "取消置顶" : "置顶展示"}
              aria-label={`${pinned ? "取消置顶" : "置顶展示"} ${image.name}`}
              className={`flex size-8 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16 ${
                pinned
                  ? "border-amber-100/38 bg-amber-100/22 text-amber-50"
                  : "border-white/12 bg-black/46 text-white"
              }`}
            >
              <StarIcon className="size-4" />
            </button>
            <button
              type="button"
              disabled={image.mediaType !== "image"}
              onClick={(event) => runQuickAction(event, onSetPreviewBackground)}
              title={
                image.mediaType === "image"
                  ? backgroundSelected
                    ? "取消背景"
                    : "设为背景"
                  : "视频不能设为背景"
              }
              aria-label={`${backgroundSelected ? "取消背景" : "设为背景"} ${image.name}`}
              className={`flex size-8 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-45 ${
                backgroundSelected
                  ? "border-cyan-100/42 bg-cyan-100/22 text-cyan-50"
                  : "border-white/12 bg-black/46 text-white"
              }`}
            >
              <PhotoIcon className="size-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={(event) => runQuickAction(event, onCopyImage)}
              title={copied ? "已复制" : "复制链接"}
              aria-label={`${copied ? "已复制" : "复制链接"} ${image.name}`}
              className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/46 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16"
            >
              {copied ? (
                <CheckIcon className="size-4 text-emerald-200" />
              ) : (
                <LinkIcon className="size-4" />
              )}
            </button>
            <button
              type="button"
              onClick={(event) => runQuickAction(event, onDownloadImage)}
              title="下载原图"
              aria-label={`下载 ${image.name}`}
              className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/46 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16"
            >
              <ArrowDownOnSquareIcon className="size-4" />
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={(event) => runQuickAction(event, onDeleteImage)}
              title={deleteConfirming ? "再次点击确认删除" : "删除"}
              aria-label={`${deleteConfirming ? "确认删除" : "删除"} ${image.name}`}
              className={`flex h-8 items-center justify-center rounded-full border shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
                deleteConfirming
                  ? "w-14 border-rose-200/28 bg-rose-400/24 px-2 text-[11px] font-medium text-rose-50"
                  : "w-8 border-white/12 bg-black/46 text-rose-100 hover:bg-rose-400/18"
              }`}
            >
              {deleting ? (
                <ArrowPathIcon className="size-4 animate-spin" />
              ) : deleteConfirming ? (
                "确认"
              ) : (
                <TrashIcon className="size-4" />
              )}
            </button>
          </>
        )}
        {active && !deleteConfirming ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClearActions();
            }}
            title="收起"
            aria-label="收起快捷操作"
            className="flex size-8 items-center justify-center rounded-full border border-white/12 bg-black/46 text-white shadow-[0_10px_26px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:bg-white/16"
          >
            <XMarkIcon className="size-4" />
          </button>
        ) : null}
      </div>

      {active ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-full border border-white/10 bg-black/42 px-3 py-1.5 text-xs font-medium text-white/72 backdrop-blur-md sm:hidden">
          {previewMode ? "已选择，可置顶或设背景" : "已选择，可复制、下载或删除"}
        </div>
      ) : null}
      {previewMode && (pinned || backgroundSelected) ? (
        <div className="pointer-events-none absolute bottom-2 left-2 hidden gap-1 sm:flex">
          {pinned ? (
            <span className="flex size-7 items-center justify-center rounded-full border border-amber-100/24 bg-black/42 text-amber-50 backdrop-blur-md">
              <StarIcon className="size-3.5" />
            </span>
          ) : null}
          {backgroundSelected ? (
            <span className="flex size-7 items-center justify-center rounded-full border border-cyan-100/24 bg-black/42 text-cyan-50 backdrop-blur-md">
              <PhotoIcon className="size-3.5" />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
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
  backgroundImageKey,
  deletingId,
  hasMore,
  historyLoading,
  images,
  loadingMore,
  onCopyImage,
  onDeleteImage,
  onDownloadImage,
  onLoadMore,
  onOpenImage,
  onSetPreviewBackground,
  onTogglePreviewPin,
  pinnedImageKeys,
  previewMode,
}: {
  backgroundImageKey: string;
  deletingId: string | null;
  hasMore: boolean;
  historyLoading: boolean;
  images: StoredImage[];
  loadingMore: boolean;
  onCopyImage: (image: StoredImage) => Promise<void>;
  onDeleteImage: (image: StoredImage) => Promise<void>;
  onDownloadImage: (image: StoredImage) => void;
  onLoadMore: () => void;
  onOpenImage: (image: StoredImage) => void;
  onSetPreviewBackground: (image: StoredImage) => void;
  onTogglePreviewPin: (image: StoredImage) => void;
  pinnedImageKeys: Set<string>;
  previewMode: boolean;
}) {
  const [activeQuickActionKey, setActiveQuickActionKey] = useState("");
  const [copiedImageKey, setCopiedImageKey] = useState("");
  const [deleteConfirmKey, setDeleteConfirmKey] = useState("");
  const copiedTimerRef = useRef<number | null>(null);
  const deleteConfirmTimerRef = useRef<number | null>(null);

  function clearCopiedTimer() {
    if (copiedTimerRef.current === null) {
      return;
    }

    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = null;
  }

  function clearDeleteConfirmTimer() {
    if (deleteConfirmTimerRef.current === null) {
      return;
    }

    window.clearTimeout(deleteConfirmTimerRef.current);
    deleteConfirmTimerRef.current = null;
  }

  async function handleQuickCopy(image: StoredImage) {
    const imageKey = getStoredImageKey(image);

    await onCopyImage(image);
    clearCopiedTimer();
    setCopiedImageKey(imageKey);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedImageKey("");
      copiedTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }

  async function handleQuickDelete(image: StoredImage) {
    const imageKey = getStoredImageKey(image);

    if (deleteConfirmKey !== imageKey) {
      clearDeleteConfirmTimer();
      setDeleteConfirmKey(imageKey);
      setActiveQuickActionKey(imageKey);
      deleteConfirmTimerRef.current = window.setTimeout(() => {
        setDeleteConfirmKey("");
        deleteConfirmTimerRef.current = null;
      }, QUICK_DELETE_CONFIRM_MS);
      return;
    }

    clearDeleteConfirmTimer();
    setDeleteConfirmKey("");
    await onDeleteImage(image);
    setActiveQuickActionKey("");
  }

  function handleActivateActions(image: StoredImage) {
    setActiveQuickActionKey(getStoredImageKey(image));
  }

  function handleClearActions() {
    setActiveQuickActionKey("");
    setDeleteConfirmKey("");
    clearDeleteConfirmTimer();
  }

  useEffect(() => {
    return () => {
      clearCopiedTimer();
      clearDeleteConfirmTimer();
    };
  }, []);

  return (
    <section className="relative z-30 px-3 pb-14 sm:px-6 sm:pb-20 lg:px-10">
      <div className="nt-media-frame mx-auto max-w-420">
        <div className="nt-media-positioner">
          <div
            data-dock-rail
            className="nt-media-dock rounded-[28px] border border-white/18 bg-white/12 px-3 py-3 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:rounded-4xl sm:px-4 sm:py-4"
          >
            {historyLoading ? (
              <MediaSkeletonGrid count={10} />
            ) : images.length > 0 ? (
              <>
                <div className="grid gap-4" style={MEDIA_GRID_STYLE}>
                  {images.map((image) => (
                    <MediaTile
                      key={image.id}
                      active={activeQuickActionKey === getStoredImageKey(image)}
                      backgroundSelected={
                        backgroundImageKey === getStoredImageKey(image)
                      }
                      copied={copiedImageKey === getStoredImageKey(image)}
                      deleteConfirming={
                        deleteConfirmKey === getStoredImageKey(image)
                      }
                      deleting={deletingId === image.id}
                      image={image}
                      onActivateActions={handleActivateActions}
                      onClearActions={handleClearActions}
                      onCopyImage={(quickImage) => {
                        void handleQuickCopy(quickImage);
                      }}
                      onDeleteImage={(quickImage) => {
                        void handleQuickDelete(quickImage);
                      }}
                      onDownloadImage={onDownloadImage}
                      onOpenImage={onOpenImage}
                      onSetPreviewBackground={onSetPreviewBackground}
                      onTogglePreviewPin={onTogglePreviewPin}
                      pinned={pinnedImageKeys.has(getStoredImageKey(image))}
                      previewMode={previewMode}
                    />
                  ))}
                </div>
                {hasMore ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-white/12 bg-black/24 px-4 text-sm font-medium text-white/78 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {loadingMore ? (
                        <ArrowPathIcon className="size-4 animate-spin" />
                      ) : null}
                      {loadingMore ? "加载中" : "加载更多"}
                    </button>
                  </div>
                ) : null}
              </>
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
  priority = false,
  visible,
}: {
  blurred: boolean;
  image: StoredImage;
  onLoad?: () => void;
  priority?: boolean;
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
            loading: priority ? "eager" : "lazy",
            fetchPriority: priority ? "high" : "auto",
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
              priority
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

function TransferAppContent({
  initialAuthorized,
  initialPayload,
}: TransferAppProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [authNotice, setAuthNotice] = useState("");
  const [pageError, setPageError] = useState("");
  const [images, setImages] = useState<StoredImage[]>(
    initialPayload?.images ?? [],
  );
  const [sources, setSources] = useState<StorageSource[]>(
    initialPayload?.sources ?? [],
  );
  const [activeSourceId, setActiveSourceId] = useState(
    initialPayload?.activeSourceId ?? "",
  );
  const [storageUsage, setStorageUsage] =
    useState<StorageUsage>(
      initialPayload?.storageUsage ?? EMPTY_STORAGE_USAGE,
    );
  const initialHero = initialPayload
    ? pickLatestHeroImage(initialPayload.images)
    : null;
  const [heroBackdrop, setHeroBackdrop] = useState<HeroBackdropState>({
    current: initialHero,
    previous: null,
    ready: false,
    version: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(
    initialAuthorized && !initialPayload,
  );
  const [needsInitialFetch, setNeedsInitialFetch] = useState(!initialPayload);
  const [hasMoreImages, setHasMoreImages] = useState(
    initialPayload?.pagination.hasMore ?? false,
  );
  const [nextImagesCursor, setNextImagesCursor] = useState<string | null>(
    initialPayload?.pagination.nextCursor ?? null,
  );
  const [loadingMoreImages, setLoadingMoreImages] = useState(false);
  const [selectedImage, setSelectedImage] = useState<StoredImage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingImages, setRefreshingImages] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareUploadOptions>(
    DEFAULT_SHARE_UPLOAD_OPTIONS,
  );
  const [sharePayload, setSharePayload] =
    useState<ShareUploadPayload | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [uploadQueueVisible, setUploadQueueVisible] = useState(false);
  const [previewConfig, setPreviewConfig] =
    useState<PreviewConfig>(loadPreviewConfig);
  const [previewSettingsOpen, setPreviewSettingsOpen] = useState(false);
  const [backgroundBlurred, setBackgroundBlurred] = useState(false);
  const delayedHeroUpdateRef = useRef<number | null>(null);
  const previewTitleDragRef = useRef<{
    initialX: number;
    initialY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const previewTitleDraggedRef = useRef(false);
  const activeSource = sources.find((source) => source.id === activeSourceId);
  const imageByKey = useMemo(() => {
    return new Map(images.map((image) => [getStoredImageKey(image), image]));
  }, [images]);
  const pinnedImageKeys = useMemo(() => {
    return new Set(previewConfig.pinnedKeys);
  }, [previewConfig.pinnedKeys]);
  const previewBackgroundImage = previewConfig.backgroundKey
    ? imageByKey.get(previewConfig.backgroundKey) ?? null
    : null;
  const previewImages = useMemo(() => {
    if (!previewConfig.enabled || previewConfig.pinnedKeys.length === 0) {
      return images;
    }

    const pinnedImages = previewConfig.pinnedKeys
      .map((imageKey) => imageByKey.get(imageKey))
      .filter((image): image is StoredImage => Boolean(image));

    if (!previewConfig.showUnpinned) {
      return pinnedImages;
    }

    return [
      ...pinnedImages,
      ...images.filter((image) => !pinnedImageKeys.has(getStoredImageKey(image))),
    ];
  }, [
    imageByKey,
    images,
    pinnedImageKeys,
    previewConfig.enabled,
    previewConfig.pinnedKeys,
    previewConfig.showUnpinned,
  ]);
  const displayTitle = previewConfig.enabled
    ? previewConfig.title || DEFAULT_PREVIEW_TITLE
    : DEFAULT_PREVIEW_TITLE;
  const previewTitleStyle = previewConfig.titleStyle;
  const previewTitleInlineStyle: React.CSSProperties = {
    color: previewTitleStyle.color,
    filter: getPreviewTitleFilter(previewTitleStyle.shadowLevel),
    transform: `translate3d(${previewTitleStyle.x}px, ${previewTitleStyle.y}px, 0) scale(${previewTitleStyle.fontScale})`,
    transformOrigin: "left center",
  };

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
      options: {
        append?: boolean;
        resetHero?: boolean;
        clearSelected?: boolean;
      } = {},
    ) => {
      setSources(payload.sources);
      setActiveSourceId(payload.activeSourceId);
      setImages((currentImages) => {
        if (!options.append) {
          return payload.images;
        }

        const knownImages = new Set(
          currentImages.map((image) => `${image.sourceId}:${image.id}`),
        );

        return [
          ...currentImages,
          ...payload.images.filter((image) => {
            const imageKey = `${image.sourceId}:${image.id}`;

            if (knownImages.has(imageKey)) {
              return false;
            }

            knownImages.add(imageKey);
            return true;
          }),
        ];
      });
      setStorageUsage(payload.storageUsage ?? EMPTY_STORAGE_USAGE);
      setHasMoreImages(payload.pagination.hasMore);
      setNextImagesCursor(payload.pagination.nextCursor);

      if (options.resetHero) {
        cancelDelayedHeroUpdate();
      }

      if (options.clearSelected) {
        cancelDelayedHeroUpdate();
        setSelectedImage(null);
      }

      setHeroBackdrop((state) => {
        if (options.append) {
          return state;
        }

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
    window.localStorage.setItem(
      PREVIEW_CONFIG_STORAGE_KEY,
      JSON.stringify(previewConfig),
    );
  }, [previewConfig]);

  useEffect(() => {
    if (!authorized || !needsInitialFetch) {
      return;
    }

    let cancelled = false;

    fetch(`/api/images?limit=${IMAGES_PAGE_SIZE}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("load failed");
        }

        const payload = (await response.json()) as ImagesPayload;

        if (!cancelled) {
          setPageError("");
          applyImagesPayload(payload, { resetHero: true });
          setNeedsInitialFetch(false);
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
  }, [
    applyImagesPayload,
    authorized,
    cancelDelayedHeroUpdate,
    needsInitialFetch,
  ]);

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

  function updatePreviewConfig(
    updater: (currentConfig: PreviewConfig) => PreviewConfig,
  ) {
    setPreviewConfig((currentConfig) => updater(currentConfig));
  }

  function enterPreviewMode() {
    setTransferModalOpen(false);
    setSelectedImage(null);
    setUploadQueueVisible(false);
    setPreviewSettingsOpen(false);
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      enabled: true,
      title: currentConfig.title.trim() || DEFAULT_PREVIEW_TITLE,
    }));
  }

  function exitPreviewMode() {
    setPreviewSettingsOpen(false);
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      enabled: false,
    }));
  }

  function savePreviewTitle(title: string) {
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      title: title.trim() || DEFAULT_PREVIEW_TITLE,
    }));
  }

  function setPreviewShowUnpinned(showUnpinned: boolean) {
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      showUnpinned,
    }));
  }

  function updatePreviewTitleStyle(titleStyle: Partial<PreviewTitleStyle>) {
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      titleStyle: sanitizePreviewTitleStyle({
        ...currentConfig.titleStyle,
        ...titleStyle,
      }),
    }));
  }

  function handlePreviewTitlePointerDown(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    previewTitleDraggedRef.current = false;
    previewTitleDragRef.current = {
      initialX: previewConfig.titleStyle.x,
      initialY: previewConfig.titleStyle.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePreviewTitlePointerMove(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    const dragState = previewTitleDragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      previewTitleDraggedRef.current = true;
    }

    updatePreviewTitleStyle({
      x: dragState.initialX + deltaX,
      y: dragState.initialY + deltaY,
    });
  }

  function handlePreviewTitlePointerEnd(
    event: React.PointerEvent<HTMLButtonElement>,
  ) {
    if (previewTitleDragRef.current?.pointerId === event.pointerId) {
      previewTitleDragRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePreviewTitleClick() {
    if (previewTitleDraggedRef.current) {
      previewTitleDraggedRef.current = false;
      return;
    }

    setPreviewSettingsOpen(true);
  }

  function togglePreviewPin(image: StoredImage) {
    const imageKey = getStoredImageKey(image);

    updatePreviewConfig((currentConfig) => {
      const pinnedKeys = currentConfig.pinnedKeys.includes(imageKey)
        ? currentConfig.pinnedKeys.filter((key) => key !== imageKey)
        : [imageKey, ...currentConfig.pinnedKeys];

      return {
        ...currentConfig,
        pinnedKeys,
      };
    });
  }

  function togglePreviewBackground(image: StoredImage) {
    if (image.mediaType !== "image") {
      return;
    }

    const imageKey = getStoredImageKey(image);

    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      backgroundKey:
        currentConfig.backgroundKey === imageKey ? "" : imageKey,
    }));
  }

  function clearPreviewPinnedImages() {
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      pinnedKeys: [],
    }));
  }

  function clearPreviewBackground() {
    updatePreviewConfig((currentConfig) => ({
      ...currentConfig,
      backgroundKey: "",
    }));
  }

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
      setNeedsInitialFetch(true);
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
    setHasMoreImages(false);
    setNextImagesCursor(null);
    setNeedsInitialFetch(true);
    updateHeroImage(null);
    setSelectedImage(null);
    setBackgroundBlurred(false);
  }

  const refreshImages = useCallback(
    async (options: { resetHero?: boolean } = {}) => {
      const response = await fetch(`/api/images?limit=${IMAGES_PAGE_SIZE}`, {
        cache: "no-store",
      });

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

  async function handleLoadMoreImages() {
    if (loadingMoreImages || !hasMoreImages || !nextImagesCursor) {
      return;
    }

    setLoadingMoreImages(true);

    try {
      const response = await fetch(
        `/api/images?limit=${IMAGES_PAGE_SIZE}&cursor=${encodeURIComponent(
          nextImagesCursor,
        )}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error("load more failed");
      }

      const payload = (await response.json()) as ImagesPayload;
      startTransition(() => {
        applyImagesPayload(payload, { append: true });
      });
      setPageError("");
    } catch {
      setPageError("加载更多失败，请稍后重试。");
    } finally {
      setLoadingMoreImages(false);
    }
  }

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

  async function generateShareUploadQr(options: ShareUploadOptions = shareDraft) {
    if (!activeSourceId || shareLoading) {
      return;
    }

    setShareLoading(true);
    setShareError("");

    try {
      const response = await fetch("/api/share-upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowVideo: options.allowVideo,
          expiresInMinutes: options.expiresInMinutes,
          maxFiles: options.maxFiles,
          sourceId: activeSourceId,
        }),
      });

      const payload = (await response.json()) as
        | ShareUploadPayload
        | { error?: string };

      if (!response.ok || !("url" in payload)) {
        const errorPayload = payload as { error?: string };
        throw new Error(errorPayload.error || "生成二维码失败");
      }

      setSharePayload(payload);
    } catch (error) {
      setSharePayload(null);
      setShareError(error instanceof Error ? error.message : "生成二维码失败");
    } finally {
      setShareLoading(false);
    }
  }

  function openShareUploadDialog() {
    setShareDraft(DEFAULT_SHARE_UPLOAD_OPTIONS);
    setShareDialogOpen(true);
    void generateShareUploadQr(DEFAULT_SHARE_UPLOAD_OPTIONS);
  }

  async function copyShareUploadLink() {
    if (!sharePayload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sharePayload.url);
    } catch {
      window.prompt("复制链接", sharePayload.url);
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

      setImages((currentImages) =>
        currentImages.filter((currentImage) => {
          return !(
            currentImage.id === image.id &&
            currentImage.sourceId === image.sourceId
          );
        }),
      );
      updatePreviewConfig((currentConfig) => {
        const imageKey = getStoredImageKey(image);

        return {
          ...currentConfig,
          backgroundKey:
            currentConfig.backgroundKey === imageKey
              ? ""
              : currentConfig.backgroundKey,
          pinnedKeys: currentConfig.pinnedKeys.filter((key) => key !== imageKey),
        };
      });
      setStorageUsage((currentUsage) => removeImageFromUsage(currentUsage, image));
      setHeroBackdrop((state) => {
        const deletingCurrent = isSameImage(state.current, image);
        const deletingPrevious = isSameImage(state.previous, image);
        const nextImages = images.filter((item) => {
          return item.id !== image.id || item.sourceId !== image.sourceId;
        });

        if (!deletingCurrent && !deletingPrevious) {
          return state;
        }

        return {
          current: deletingCurrent ? pickLatestHeroImage(nextImages) : state.current,
          previous: deletingPrevious ? null : state.previous,
          ready: deletingCurrent ? false : state.ready,
          version: state.version + 1,
        };
      });
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
      setHeroBackdrop((state) => {
        if (!state.current || state.ready) {
          return state;
        }

        return {
          ...state,
          ready: true,
        };
      });

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
        currentHero={previewBackgroundImage ?? heroBackdrop.current}
        currentReady={previewBackgroundImage ? true : heroBackdrop.ready}
        onCurrentHeroLoad={handleHeroImageLoad}
        previousHero={heroBackdrop.previous}
      />

      {!previewConfig.enabled ? (
        <div className="absolute left-4 right-4 top-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-3xl border border-white/14 bg-black/28 p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:fixed sm:left-auto sm:right-6 sm:top-6 sm:max-w-none sm:flex-row sm:items-center sm:gap-2 sm:rounded-full">
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
              onClick={openShareUploadDialog}
              disabled={!activeSourceId || historyLoading}
              aria-label="生成上传二维码"
              title="生成上传二维码"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
            >
              <QrCodeIcon className="size-5" />
            </button>
            <button
              type="button"
              onClick={enterPreviewMode}
              aria-label="进入预览模式"
              title="进入预览模式"
              className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white"
            >
              <EyeIcon className="size-5" />
            </button>
            {sources.length > 1 ? (
              <button
                type="button"
                onClick={() => setTransferModalOpen(true)}
                aria-label="迁移媒体"
                title="迁移媒体"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/78 transition hover:bg-white/14 hover:text-white"
              >
                <ArrowsRightLeftIcon className="size-5" />
              </button>
            ) : null}
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
      ) : null}

      <section
        className={`relative z-10 flex transition-[height,min-height] duration-300 ${
          uploadQueueVisible ? "min-h-[calc(100dvh+22rem)] sm:min-h-0 sm:h-dvh" : "h-dvh"
        }`}
      >
        <div className="relative z-20 flex w-full flex-col px-5 pb-56 pt-24 sm:px-8 sm:pb-64 sm:pt-28 lg:px-14">
          <div className="max-w-xl pt-[16vh] sm:pt-[10vh]">
            {previewConfig.enabled ? (
              <button
                type="button"
                onClick={handlePreviewTitleClick}
                onPointerDown={handlePreviewTitlePointerDown}
                onPointerMove={handlePreviewTitlePointerMove}
                onPointerUp={handlePreviewTitlePointerEnd}
                onPointerCancel={handlePreviewTitlePointerEnd}
                className={`${PREVIEW_TITLE_BASE_CLASS} inline-block cursor-grab select-none text-left transition hover:opacity-90 active:cursor-grabbing focus-visible:outline focus-visible:outline-white/70 [touch-action:none]`}
                style={previewTitleInlineStyle}
              >
                {displayTitle}
              </button>
            ) : (
              <h1 className={PREVIEW_TITLE_BASE_CLASS}>
                {displayTitle}
              </h1>
            )}
            {!previewConfig.enabled ? (
              <div className="relative z-40 mt-14">
                <TransferUploadPanel
                  onQueueVisibilityChange={setUploadQueueVisible}
                  onUploaded={refreshImages}
                  sourceId={activeSourceId}
                  sourcePrefix={activeSource?.prefix ?? "uploads/"}
                  uploadMode={activeSource?.uploadMode ?? DEFAULT_UPLOAD_MODE}
                />
              </div>
            ) : null}
            {pageError && !previewConfig.enabled ? (
              <p className="mt-4 max-w-sm rounded-2xl border border-rose-300/18 bg-rose-950/35 px-4 py-3 text-sm text-rose-100 backdrop-blur-xl">
                {pageError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <MediaShelf
        backgroundImageKey={previewConfig.backgroundKey}
        deletingId={deletingId}
        hasMore={
          previewConfig.enabled &&
          previewConfig.pinnedKeys.length > 0 &&
          !previewConfig.showUnpinned
            ? false
            : hasMoreImages
        }
        historyLoading={historyLoading}
        images={previewImages}
        loadingMore={loadingMoreImages}
        onCopyImage={handleCopyLink}
        onDeleteImage={handleDelete}
        onDownloadImage={handleDownload}
        onLoadMore={() => void handleLoadMoreImages()}
        onOpenImage={openImageViewer}
        onSetPreviewBackground={togglePreviewBackground}
        onTogglePreviewPin={togglePreviewPin}
        pinnedImageKeys={pinnedImageKeys}
        previewMode={previewConfig.enabled}
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

      {transferModalOpen ? (
        <SourceTransferModal
          activeSourceId={activeSourceId}
          images={images}
          sources={sources}
          onClose={() => setTransferModalOpen(false)}
          onTransferred={() => refreshImages({ resetHero: true })}
        />
      ) : null}

      {shareDialogOpen ? (
        <ShareUploadDialog
          draft={shareDraft}
          error={shareError}
          loading={shareLoading}
          payload={sharePayload}
          onClose={() => setShareDialogOpen(false)}
          onCopyLink={() => void copyShareUploadLink()}
          onRegenerate={() => void generateShareUploadQr()}
          onUpdateDraft={setShareDraft}
        />
      ) : null}

      {previewSettingsOpen ? (
        <PreviewSettingsDialog
          backgroundSelected={Boolean(previewConfig.backgroundKey)}
          pinnedCount={previewConfig.pinnedKeys.length}
          showUnpinned={previewConfig.showUnpinned}
          title={previewConfig.title}
          titleStyle={previewConfig.titleStyle}
          onClearBackground={clearPreviewBackground}
          onClearPinned={clearPreviewPinnedImages}
          onClose={() => setPreviewSettingsOpen(false)}
          onExitPreview={exitPreviewMode}
          onSaveTitle={savePreviewTitle}
          onSetShowUnpinned={setPreviewShowUnpinned}
          onUpdateTitleStyle={updatePreviewTitleStyle}
        />
      ) : null}
    </main>
  );
}
