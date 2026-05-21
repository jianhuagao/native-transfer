import { TransferModeShell } from "@/app/_components/transfer-mode-shell";
import { isAuthorized } from "@/app/_lib/auth";
import { getImagesPayload } from "@/app/_lib/storage";

export default async function Home() {
  const authorized = await isAuthorized();
  const initialPayload = authorized ? await getImagesPayload() : null;

  return (
    <TransferModeShell
      initialAuthorized={authorized}
      initialPayload={initialPayload}
    />
  );
}
