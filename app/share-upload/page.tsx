import { ShareUploadApp } from "@/app/_components/share-upload-app";
import {
  isShareUploadTokenActive,
  readShareUploadToken,
} from "@/app/_lib/auth";
import {
  getShareUploadPathPrefix,
  getShareUploadSource,
} from "@/app/_lib/share-upload";

function InvalidShareUploadPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#050505] px-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/12 bg-white/8 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <h1 className="text-xl font-semibold">二维码已失效</h1>
        <p className="mt-2 text-sm text-white/58">
          请联系分享者重新生成二维码后再上传图片。
        </p>
      </section>
    </main>
  );
}

export default async function ShareUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;
  const payload = readShareUploadToken(token ?? null);

  if (!payload || !isShareUploadTokenActive(payload)) {
    return <InvalidShareUploadPage />;
  }

  let source: ReturnType<typeof getShareUploadSource>;
  let uploadPathPrefix = "";

  try {
    source = getShareUploadSource(payload);
    uploadPathPrefix = getShareUploadPathPrefix(payload);
  } catch {
    return <InvalidShareUploadPage />;
  }

  return (
    <ShareUploadApp
      allowVideo={payload.allowVideo}
      expiresAt={payload.expiresAt}
      maxFiles={payload.maxFiles}
      sourceId={source.id}
      sourceLabel={source.label}
      sourcePrefix={source.prefix}
      token={token ?? ""}
      uploadPathPrefix={uploadPathPrefix}
      uploadMode={source.uploadMode}
    />
  );
}
