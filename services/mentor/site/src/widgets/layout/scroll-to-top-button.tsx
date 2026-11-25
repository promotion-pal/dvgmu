"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export const ScrollToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Наверх"
      className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#c9a84c] text-[#1a1a2e] flex items-center justify-center shadow-2xl hover:bg-[#d4b85c] transition"
    >
      <ArrowUp className="w-6 h-6 sm:w-7 sm:h-7" />
    </button>
  );
};
