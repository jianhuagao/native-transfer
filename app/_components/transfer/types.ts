export type TabKey = "transfer" | "history";

export type StoredImage = {
  id: string;
  name: string;
  url: string;
  originalUrl: string;
  uploadedAt: string;
  uploadedAtLabel: string;
  size: number;
};

export type TransferAppProps = {
  initialAuthorized: boolean;
};

export type ConfettiKind = "upload" | "copy";
