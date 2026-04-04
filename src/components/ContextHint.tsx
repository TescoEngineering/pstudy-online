"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

type ContextHintProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Compact “i” control: explanation shows on hover, keyboard focus, or tap (pinned until tap again or click outside).
 */
export function ContextHint({ children, className = "" }: ContextHintProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focused, setFocused] = useState(false);

  const visible = hover || pinned || focused;

  useEffect(() => {
    if (!pinned) return;
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [pinned]);

  const onBlurBtn = useCallback((e: React.FocusEvent<HTMLButtonElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setFocused(false);
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex align-baseline ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-[10px] font-bold leading-none text-stone-600 shadow-sm hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pstudy-primary focus-visible:ring-offset-2"
        aria-expanded={visible}
        aria-controls={panelId}
        aria-label={t("common.contextHintLabel")}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setFocused(true)}
        onBlur={onBlurBtn}
      >
        i
      </button>
      <div
        id={panelId}
        role="tooltip"
        className={`absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-stone-200 bg-white p-3 text-left text-sm font-normal leading-relaxed text-stone-700 shadow-lg transition-opacity duration-150 ${
          visible ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
