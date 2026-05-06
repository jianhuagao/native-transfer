import { TransferApp } from "@/app/_components/transfer-app";
import { isAuthorized } from "@/app/_lib/auth";
import { getImagesPayload } from "@/app/_lib/storage";

export default async function Home() {
  const authorized = await isAuthorized();
  const initialPayload = authorized ? await getImagesPayload() : null;

  return (
    <TransferApp
      initialAuthorized={authorized}
      initialPayload={initialPayload}
    />
  );
}
