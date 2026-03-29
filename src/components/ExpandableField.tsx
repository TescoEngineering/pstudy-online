"use client";

import { useState, useEffect } from "react";

type ExpandableFieldProps = {
  /** DB / state may pass null; empty must stay "" so placeholders show. */
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  /** Rows for compact inline view (default 2). Use 1 for single-line MC options. */
  compactRows?: number;
  compactClassName?: string;
  /** When set, expanded modal shows an extra action (e.g. apply this text to every row). */
  onApplyToAll?: (value: string) => void;
  applyToAllLabel?: string;
};

export function ExpandableField({
  value,
  onChange,
  placeholder,
  className = "",
  rows = 6,
  compactRows = 2,
  compactClassName = "",
  onApplyToAll,
  applyToAllLabel,
}: ExpandableFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(() => toFieldString(value));

  useEffect(() => {
    setLocalValue(toFieldString(value));
  }, [value, isExpanded]);

  const handleOpen = () => {
    setIsExpanded(true);
    setLocalValue(toFieldString(value));
  };

  const handleClose = () => {
    onChange(normalizeCommit(localValue));
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleClose();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setLocalValue(toFieldString(value));
      setIsExpanded(false);
    }
  };

  const compactValue = toFieldString(value);

  return (
    <>
      <textarea
        value={compactValue}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const v = e.currentTarget.value;
          if (v !== "" && v.trim() === "") onChange("");
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          handleOpen();
        }}
        rows={compactRows}
        title="Double-click to expand"
        className={`block w-full resize-none rounded border border-stone-200 px-2 py-1 text-left text-stone-800 placeholder:text-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary ${compactClassName}`}
        placeholder={placeholder || "Click to edit"}
      />

      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div
            className="w-full max-w-2xl rounded-lg border border-stone-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              value={toFieldString(localValue)}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={rows}
              className={`w-full resize-none rounded border border-stone-300 px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary ${className}`}
              placeholder={placeholder}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-500">
                Press <kbd className="rounded bg-stone-100 px-1 py-0.5">Enter</kbd> to
                save · <kbd className="rounded bg-stone-100 px-1 py-0.5">Esc</kbd> to cancel
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onApplyToAll ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onApplyToAll(normalizeCommit(localValue));
                      setIsExpanded(false);
                    }}
                    className="rounded border border-stone-300 bg-stone-100 px-3 py-1 text-sm font-medium text-stone-800 hover:bg-stone-200"
                  >
                    {applyToAllLabel ?? "Apply to all"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClose}
                  className="rounded bg-pstudy-primary px-3 py-1 text-sm font-medium text-white hover:bg-teal-600"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function toFieldString(v: string | null | undefined): string {
  if (v == null) return "";
  return String(v);
}

/** Collapse whitespace-only to "" so empty fields stay consistent with placeholders. */
function normalizeCommit(v: string | null | undefined): string {
  const s = toFieldString(v);
  return s.trim() === "" ? "" : s;
}
