'use client';

import { useEffect } from 'react';

export default function ViewportResize() {
  useEffect(() => {
    const baseWidth = 1920; // 设计稿宽度，可改为 1920
    const baseFontSize = 16; // 基准 rem 值

    const setSize = () => {
      const width = window.innerWidth;
      const scale = width / baseWidth;
      const fontSize = baseFontSize * scale;

      // 限制最大最小，避免超大或超小屏幕畸形
      const finalSize = Math.max(14, Math.min(fontSize, 20));
      document.documentElement.style.fontSize = `${finalSize}px`;
    };

    setSize();
    window.addEventListener('resize', setSize);
    return () => window.removeEventListener('resize', setSize);
  }, []);

  return null;
}
