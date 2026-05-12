"use client";

import { TransferUploadPanel } from "@/app/_components/transfer/transfer-upload-panel";

type ShareUploadAppProps = {
  allowVideo: boolean;
  expiresAt: number;
  maxFiles: number;
  sourceId: string;
  sourceLabel: string;
  sourcePrefix: string;
  uploadPathPrefix: string;
  token: string;
  uploadMode: "form-data" | "s3-presigned-url" | "vercel-blob-client";
};

function formatExpiresAt(expiresAt: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(expiresAt));
}

export function ShareUploadApp({
  allowVideo,
  expiresAt,
  maxFiles,
  sourceId,
  sourceLabel,
  sourcePrefix,
  uploadPathPrefix,
  token,
  uploadMode,
}: ShareUploadAppProps) {
  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-[#050505] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(125,211,252,0.18),transparent_32%),linear-gradient(135deg,#071018_0%,#050505_54%,#15100a_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,transparent_34%,rgba(0,0,0,0.54)_100%)]" />

      <section className="relative z-10 flex w-full flex-col justify-center px-5 py-12 sm:px-8 lg:px-14">
        <div className="w-full max-w-xl">
          <p className="text-sm font-medium text-cyan-100/78">{sourceLabel}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight text-white sm:text-6xl">
            Native Transfer
          </h1>
          <div className="mt-5 flex flex-wrap gap-2 text-sm text-white/72">
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
              有效至 {formatExpiresAt(expiresAt)}
            </span>
            <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
              最多 {maxFiles} 张
            </span>
          </div>

          <div className="relative z-20 mt-10">
            <TransferUploadPanel
              allowVideo={allowVideo}
              helperText="可多选、拖拽或粘贴上传"
              maxFiles={maxFiles}
              onUploaded={async () => undefined}
              shareToken={token}
              sourceId={sourceId}
              sourcePrefix={sourcePrefix}
              uploadPathPrefix={uploadPathPrefix}
              uploadEndpoint={`/api/share-upload/upload?token=${encodeURIComponent(
                token,
              )}`}
              uploadMode={uploadMode}
              uploadTitle="上传"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
