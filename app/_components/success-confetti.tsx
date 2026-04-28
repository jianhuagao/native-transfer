"use client";

import Lottie from "lottie-react";
import type { ComponentProps } from "react";

type SuccessConfettiProps = {
  playToken: number;
  visible: boolean;
  animationData: ComponentProps<typeof Lottie>["animationData"];
  onComplete: () => void;
};

export function SuccessConfetti({
  playToken,
  visible,
  animationData,
  onComplete,
}: SuccessConfettiProps) {
  if (!visible || playToken === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-80 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 size-[min(72vw,34rem)] -translate-x-1/2 -translate-y-1/2 sm:size-136">
        <Lottie
          key={playToken}
          animationData={animationData}
          autoplay
          loop={false}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}
