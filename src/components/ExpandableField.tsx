"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { splitKeywordTags, splitKeywordTagsForHighlight } from "@/lib/flashcard";
import { KeywordHighlight } from "@/components/KeywordHighlight";
import { isSpeechRecognitionSupported, startListening } from "@/lib/speech";
import { useToast } from "@/components/Toast";

type KeywordTaggingApi = {
  keywords: string;
  onKeywordsChange: (next: string) => void;
};

export type DictationOptions = {
  /** Speech recognition locale (default: Practice “Speech language” from localStorage, else `en`). */
  lang?: string;
};

/** Expand range so any partially included non-whitespace run is fully included (full “word” = run of non-whitespace). */
function expandToWordRuns(text: string, start: number, end: number): [number, number] {
  let s = Math.max(0, Math.min(start, text.length));
  let e = Math.max(0, Math.min(end, text.length));
  if (e < s) [s, e] = [e, s];
  while (s > 0 && /\S/.test(text[s - 1]!)) s--;
  while (e < text.length && /\S/.test(text[e]!)) e++;
  return [s, e];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if [selStart, selEnd) overlaps any case-insensitive occurrence of `keyword` in `fullText`. */
function keywordOverlapsSelection(
  fullText: string,
  selStart: number,
  selEnd: number,
  keyword: string
): boolean {
  const k = keyword.trim();
  if (!k) return false;
  const re = new RegExp(escapeRegExp(k), "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullText)) !== null) {
    const pos = m.index;
    const matchEnd = pos + m[0].length;
    if (pos < selEnd && matchEnd > selStart) return true;
    if (m[0].length === 0) re.lastIndex++;
  }
  return false;
}

function resolveDictationLang(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (typeof window !== "undefined") {
    try {
      const s = localStorage.getItem("pstudy-speech-lang");
      if (s?.trim()) return s.trim();
    } catch {
      /* ignore */
    }
  }
  return "en";
}

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
  /**
   * If true (default), plain Enter in the expanded modal saves and closes.
   * Set false for multiline fields (e.g. flashcard answer with bullets) so Enter inserts a newline;
   * use Done or click outside to save.
   */
  saveOnEnter?: boolean;
  /**
   * Expanded editor: select text and add it to the Keywords field + live highlight preview (flashcard practice).
   */
  keywordTagging?: KeywordTaggingApi;
  /** Browser speech-to-text in the expanded editor (Chrome / Edge Web Speech API). */
  dictation?: DictationOptions;
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
  saveOnEnter = true,
  keywordTagging,
  dictation,
}: ExpandableFieldProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localValue, setLocalValue] = useState(() => toFieldString(value));
  const expandedTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  /** Backdrop for keyword highlights: scroll position synced from textarea (plain textarea cannot style partial text). */
  const keywordHighlightLayerRef = useRef<HTMLDivElement | null>(null);
  const dictationStopRef = useRef<(() => void) | null>(null);
  const dictationWantedRef = useRef(false);
  const dictationRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dictationListening, setDictationListening] = useState(false);

  useEffect(() => {
    setLocalValue(toFieldString(value));
  }, [value, isExpanded]);

  const stopDictation = useCallback(() => {
    dictationWantedRef.current = false;
    if (dictationRestartTimerRef.current) {
      clearTimeout(dictationRestartTimerRef.current);
      dictationRestartTimerRef.current = null;
    }
    dictationStopRef.current?.();
    dictationStopRef.current = null;
    setDictationListening(false);
  }, []);

  useEffect(() => {
    return () => {
      dictationWantedRef.current = false;
      if (dictationRestartTimerRef.current) {
        clearTimeout(dictationRestartTimerRef.current);
        dictationRestartTimerRef.current = null;
      }
      dictationStopRef.current?.();
      dictationStopRef.current = null;
    };
  }, []);

  const startDictation = useCallback(() => {
    if (!dictation) return;
    if (!isSpeechRecognitionSupported()) {
      toast.error(t("practice.speechInputUnavailable"));
      return;
    }
    const lang = resolveDictationLang(dictation.lang);
    stopDictation();
    dictationWantedRef.current = true;
    setDictationListening(true);

    const runListen = () => {
      if (!dictationWantedRef.current) return;
      const stop = startListening({
        lang,
        continuous: true,
        onResult: (text, isFinal) => {
          if (!isFinal || !text.trim()) return;
          if (!dictationWantedRef.current) return;
          const ta = expandedTextareaRef.current;
          if (!ta) return;
          const ttext = text.trim();
          setLocalValue((prev) => {
            const s = Math.min(Math.max(0, ta.selectionStart), prev.length);
            const e = Math.min(Math.max(0, ta.selectionEnd), prev.length);
            const before = prev.slice(0, s);
            const after = prev.slice(e);
            let mid = ttext;
            const needsSpaceBefore =
              before.length > 0 && !/\s$/.test(before);
            const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);
            if (needsSpaceBefore) mid = ` ${mid}`;
            if (needsSpaceAfter) mid = `${mid} `;
            const next = before + mid + after;
            const caret = (before + mid).length;
            queueMicrotask(() => {
              const t2 = expandedTextareaRef.current;
              if (t2) {
                t2.focus();
                t2.setSelectionRange(caret, caret);
              }
            });
            return next;
          });
        },
        onError: (msg) => {
          toast.error(msg);
          stopDictation();
        },
        onEnd: () => {
          if (!dictationWantedRef.current) return;
          dictationRestartTimerRef.current = setTimeout(() => {
            dictationRestartTimerRef.current = null;
            if (!dictationWantedRef.current) return;
            dictationStopRef.current?.();
            dictationStopRef.current = null;
            runListen();
          }, 380);
        },
      });
      if (stop) {
        dictationStopRef.current = stop;
      } else {
        toast.error(t("practice.speechInputUnavailable"));
        stopDictation();
      }
    };

    runListen();
  }, [dictation, stopDictation, toast, t]);

  const toggleDictation = useCallback(() => {
    if (dictationListening) stopDictation();
    else startDictation();
  }, [dictationListening, startDictation, stopDictation]);

  const handleOpen = () => {
    setIsExpanded(true);
    setLocalValue(toFieldString(value));
  };

  const handleClose = () => {
    stopDictation();
    onChange(normalizeCommit(localValue));
    setIsExpanded(false);
  };

  const syncKeywordHighlightScroll = useCallback(() => {
    const ta = expandedTextareaRef.current;
    const layer = keywordHighlightLayerRef.current;
    if (!ta || !layer) return;
    layer.style.transform = `translateY(-${ta.scrollTop}px)`;
  }, []);

  useLayoutEffect(() => {
    if (!isExpanded || !keywordTagging) return;
    syncKeywordHighlightScroll();
  }, [isExpanded, keywordTagging, localValue, syncKeywordHighlightScroll]);

  const addSelectionAsKeyword = useCallback(() => {
    if (!keywordTagging) return;
    const ta = expandedTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const text = toFieldString(localValue);
    const [from, to] = expandToWordRuns(text, start, end);
    const phrase = text.slice(from, to).replace(/\s+/g, " ").trim();
    if (phrase.length < 2) return;
    const existing = splitKeywordTags(keywordTagging.keywords);
    const seen = new Set(existing.map((k) => k.toLowerCase()));
    if (seen.has(phrase.toLowerCase())) return;
    existing.push(phrase);
    keywordTagging.onKeywordsChange(existing.join("; "));
  }, [keywordTagging, localValue]);

  const removeSelectionFromKeywords = useCallback(() => {
    if (!keywordTagging) return;
    const ta = expandedTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    const text = toFieldString(localValue);
    const existing = splitKeywordTags(keywordTagging.keywords);
    const next = existing.filter(
      (k) => !keywordOverlapsSelection(text, start, end, k)
    );
    if (next.length === existing.length) return;
    keywordTagging.onKeywordsChange(next.join("; "));
  }, [keywordTagging, localValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (saveOnEnter && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleClose();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      stopDictation();
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
            {keywordTagging ? (
              <div className="relative w-full overflow-hidden rounded border border-stone-300 focus-within:border-pstudy-primary focus-within:ring-2 focus-within:ring-pstudy-primary">
                <div
                  className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded"
                  aria-hidden
                >
                  <div
                    ref={keywordHighlightLayerRef}
                    className={`box-border px-3 py-2 text-left text-base leading-normal text-stone-800 ${className}`}
                  >
                    {toFieldString(localValue) ? (
                      <KeywordHighlight
                        text={toFieldString(localValue)}
                        keywords={splitKeywordTagsForHighlight(keywordTagging.keywords)}
                      />
                    ) : (
                      <span className="whitespace-pre-wrap break-words">{"\u00a0"}</span>
                    )}
                  </div>
                </div>
                <textarea
                  ref={expandedTextareaRef}
                  value={toFieldString(localValue)}
                  onChange={(e) => setLocalValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onScroll={syncKeywordHighlightScroll}
                  autoFocus
                  rows={rows}
                  spellCheck={false}
                  className={`relative z-10 box-border min-h-[10rem] w-full resize-y border-0 bg-transparent px-3 py-2 text-left text-base leading-normal text-transparent caret-stone-800 placeholder:text-stone-400 selection:bg-teal-200/40 focus:outline-none focus:ring-0 ${className}`}
                  placeholder={placeholder}
                />
              </div>
            ) : (
              <textarea
                ref={expandedTextareaRef}
                value={toFieldString(localValue)}
                onChange={(e) => setLocalValue(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                rows={rows}
                className={`w-full rounded border border-stone-300 px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:border-pstudy-primary focus:outline-none focus:ring-2 focus:ring-pstudy-primary ${
                  dictation ? "min-h-[10rem] resize-y" : "resize-none"
                } ${className}`}
                placeholder={placeholder}
              />
            )}
            {dictation && isSpeechRecognitionSupported() ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleDictation}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    dictationListening
                      ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                      : "border-stone-300 bg-white text-stone-700 hover:border-pstudy-primary hover:text-pstudy-primary"
                  }`}
                >
                  {dictationListening
                    ? t("deck.dictationStop")
                    : t("deck.dictationStart")}
                </button>
                <span className="text-xs text-stone-500">{t("deck.dictationHint")}</span>
                {dictationListening ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                    {t("deck.dictationListening")}
                  </span>
                ) : null}
              </div>
            ) : null}
            {keywordTagging ? (
              <div className="mt-3 space-y-2 rounded-lg border border-amber-100/80 bg-amber-50/30 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={addSelectionAsKeyword}
                    className="rounded border border-amber-300 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-950 hover:bg-amber-200"
                  >
                    {t("deck.addSelectionAsKeyword")}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={removeSelectionFromKeywords}
                    className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:border-amber-400 hover:bg-amber-50"
                  >
                    {t("deck.removeSelectionFromKeyword")}
                  </button>
                </div>
                <p className="text-xs text-stone-600">{t("deck.keywordMarkerHint")}</p>
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-stone-500">
                {saveOnEnter ? (
                  <>
                    Press <kbd className="rounded bg-stone-100 px-1 py-0.5">Enter</kbd> to
                    save · <kbd className="rounded bg-stone-100 px-1 py-0.5">Shift</kbd>+
                    <kbd className="rounded bg-stone-100 px-1 py-0.5">Enter</kbd> for new line ·{" "}
                    <kbd className="rounded bg-stone-100 px-1 py-0.5">Esc</kbd> to cancel
                  </>
                ) : (
                  <>
                    <kbd className="rounded bg-stone-100 px-1 py-0.5">Enter</kbd> adds a line · Done
                    or click outside to save ·{" "}
                    <kbd className="rounded bg-stone-100 px-1 py-0.5">Esc</kbd> to cancel
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onApplyToAll ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      stopDictation();
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
