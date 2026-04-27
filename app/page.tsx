import { TransferApp } from "@/app/_components/transfer-app";
import { isAuthorized } from "@/app/_lib/auth";

export default async function Home() {
  const authorized = await isAuthorized();

  return <TransferApp initialAuthorized={authorized} />;
}
