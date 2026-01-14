"use client";

import React, { useEffect, useRef } from 'react';

interface AddToCartAnimationProps {
  animation: {
    isAnimating: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;
}

export default function AddToCartAnimation({ animation }: AddToCartAnimationProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animation?.isAnimating || !elementRef.current) return;

    const element = elementRef.current;
    const { startX, startY, endX, endY } = animation;

    // Reset styles
    element.style.transition = 'none';
    element.style.left = `${startX}px`;
    element.style.top = `${startY}px`;
    element.style.transform = 'translate(-50%, -50%) scale(1)';
    element.style.opacity = '1';

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        element.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        element.style.left = `${endX}px`;
        element.style.top = `${endY}px`;
        element.style.transform = 'translate(-50%, -50%) scale(0.3)';
        element.style.opacity = '0';
      });
    });
  }, [animation]);

  if (!animation?.isAnimating) return null;

  return (
    <div
      ref={elementRef}
      className="fixed z-[9999] pointer-events-none"
      style={{
        left: `${animation.startX}px`,
        top: `${animation.startY}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="bg-primary rounded-full p-2 shadow-lg ring-4 ring-purple-200">
        <span className="material-symbols-outlined text-white text-xl">
          shopping_cart
        </span>
      </div>
    </div>
  );
}
