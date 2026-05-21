"use client";

import { LiteTransferApp } from "@/app/_components/lite-transfer-app";
import { TransferApp } from "@/app/_components/transfer-app";
import type {
  ImagesPayload,
  TransferViewMode,
} from "@/app/_components/transfer/types";
import { useCallback, useState, useSyncExternalStore } from "react";

const VIEW_MODE_STORAGE_KEY = "native-transfer:view-mode";
const VIEW_MODE_CHANGE_EVENT = "native-transfer:view-mode-change";
const DEFAULT_VIEW_MODE: TransferViewMode = "full";
let fallbackViewMode: TransferViewMode = DEFAULT_VIEW_MODE;

function readStoredViewMode(): TransferViewMode {
  try {
    const storedMode = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);

    return storedMode === "lite" || storedMode === "full"
      ? storedMode
      : DEFAULT_VIEW_MODE;
  } catch {
    return fallbackViewMode;
  }
}

function writeStoredViewMode(mode: TransferViewMode) {
  fallbackViewMode = mode;

  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }

  window.dispatchEvent(new Event(VIEW_MODE_CHANGE_EVENT));
}

function getServerViewModeSnapshot(): TransferViewMode {
  return DEFAULT_VIEW_MODE;
}

type TransferModeShellProps = {
  initialAuthorized: boolean;
  initialPayload: ImagesPayload | null;
};

export function TransferModeShell({
  initialAuthorized,
  initialPayload,
}: TransferModeShellProps) {
  const [authorized, setAuthorized] = useState(initialAuthorized);
  const [payloadSnapshot, setPayloadSnapshot] = useState(initialPayload);

  const mode = useSyncExternalStore(
    (onStoreChange) => {
      function handleStorage(event: StorageEvent) {
        if (event.key !== VIEW_MODE_STORAGE_KEY) {
          return;
        }

        setPayloadSnapshot(null);
        onStoreChange();
      }

      function handleSameWindowChange() {
        onStoreChange();
      }

      window.addEventListener("storage", handleStorage);
      window.addEventListener(VIEW_MODE_CHANGE_EVENT, handleSameWindowChange);

      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(
          VIEW_MODE_CHANGE_EVENT,
          handleSameWindowChange,
        );
      };
    },
    readStoredViewMode,
    getServerViewModeSnapshot,
  );

  const handleModeChange = useCallback(
    (nextMode: TransferViewMode) => {
      if (nextMode === mode) {
        return;
      }

      setPayloadSnapshot(null);
      writeStoredViewMode(nextMode);
    },
    [mode],
  );

  const sharedProps = {
    initialAuthorized: authorized,
    initialPayload: authorized ? payloadSnapshot : null,
    onAuthorizedChange: setAuthorized,
    onModeChange: handleModeChange,
  };

  return mode === "lite" ? (
    <LiteTransferApp key="lite" {...sharedProps} />
  ) : (
    <TransferApp key="full" {...sharedProps} />
  );
}
