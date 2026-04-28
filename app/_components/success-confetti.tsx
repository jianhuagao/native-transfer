"use client";

import Lottie from "lottie-react";
import confettiSuccessAnimation from "@/public/lotties/confetti-success.json";

type SuccessConfettiProps = {
  playToken: number;
  visible: boolean;
  onComplete: () => void;
};

export function SuccessConfetti({
  playToken,
  visible,
  onComplete,
}: SuccessConfettiProps) {
  if (!visible || playToken === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[min(72vw,34rem)] w-[min(72vw,34rem)] -translate-x-1/2 -translate-y-1/2 sm:h-[34rem] sm:w-[34rem]">
        <Lottie
          key={playToken}
          animationData={confettiSuccessAnimation}
          autoplay
          loop={false}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
}
