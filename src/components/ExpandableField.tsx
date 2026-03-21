"use client";

import { useState, useEffect } from "react";

type ExpandableFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  /** Rows for compact inline view (default 2). Use 1 for single-line MC options. */
  compactRows?: number;
  compactClassName?: string;
};

export function ExpandableField({
  value,
  onChange,
  placeholder,
  className = "",
  rows = 6,
  compactRows = 2,
  compactClassName = "",
}: ExpandableFieldProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value, isExpanded]);

  const handleOpen = () => {
    setIsExpanded(true);
    setLocalValue(value);
  };

  const handleClose = () => {
    onChange(localValue);
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleClose();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setLocalValue(value);
      setIsExpanded(false);
    }
  };

  return (
    <>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDoubleClick={(e) => {
          e.preventDefault();
          handleOpen();
        }}
        rows={compactRows}
        title="Double-click to expand"
        className={`block w-full resize-none rounded border border-stone-200 px-2 py-1 text-left focus:border-pstudy-primary focus:outline-none focus:ring-1 focus:ring-pstudy-primary ${compactClassName}`}
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
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleClose}
              autoFocus
              rows={rows}
              className={`w-full resize-none rounded border border-stone-300 px-3 py-2 focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary ${className}`}
              placeholder={placeholder}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm text-stone-500">
                Press <kbd className="rounded bg-stone-100 px-1 py-0.5">Enter</kbd> to
                save · <kbd className="rounded bg-stone-100 px-1 py-0.5">Esc</kbd> to cancel
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="rounded bg-pstudy-primary px-3 py-1 text-sm font-medium text-white hover:bg-teal-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
