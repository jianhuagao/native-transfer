import { LiteTransferApp } from "@/app/_components/lite-transfer-app";
import { isAuthorized } from "@/app/_lib/auth";
import { getImagesPayload } from "@/app/_lib/storage";

export default async function LitePage() {
  const authorized = await isAuthorized();
  const initialPayload = authorized ? await getImagesPayload() : null;

  return (
    <LiteTransferApp
      initialAuthorized={authorized}
      initialPayload={initialPayload}
    />
  );
}
