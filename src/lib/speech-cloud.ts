/**
 * Google Cloud Speech-to-Text client.
 * Records audio from the microphone, sends chunks to our API with phrase hints.
 * Use when "Consider only deck answers" is enabled for much better accuracy.
 */

import { normalizeSpeechLocale } from "@/lib/speech-locale";
import { speechDiag } from "@/lib/speech-diagnostics";

export type CloudSpeechOptions = {
  lang?: string;
  vocabulary?: string[];
  /** Normalized heard → deck answer; optional per-deck mappings from localStorage. */
  sttAliases?: Readonly<Record<string, string>>;
  onResult: (transcript: string, isFinal: boolean) => void;
  onHeardLine?: (line: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
  /**
   * When this returns true, chunk upload results are dropped (practice advanced or mic stopped).
   * Prevents late responses from touching React state after dozens of item transitions.
   */
  shouldIgnoreResults?: () => boolean;
};

const CHUNK_MS = 1200;
/**
 * Each POST to Google must be a standalone WEBM/Opus file. Chunks from a long-lived
 * MediaRecorder (timeslice or requestData) are usually mux fragments without a fresh Ebml
 * header — only the first decode, which matches “nothing after ~CHUNK_MS”.
 * Fix: one MediaRecorder per slice; stop() yields one complete WebM blob per interval.
 */
const MAX_PARALLEL_UPLOADS = 4;
const CHUNK_FETCH_MS = 45_000;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Start cloud-based speech recognition.
 * Sends frequent audio chunks with phrase hints (Google STT via our API).
 * Returns a stop function, or null if not available (no mic, etc.).
 */
export function startCloudListening(
  options: CloudSpeechOptions
): (() => void) | null {
  if (typeof window === "undefined") return null;

  let stopped = false;
  let stream: MediaStream | null = null;
  let activeRecorder: MediaRecorder | null = null;
  let sliceArmTimer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let lastAppliedSeq = 0;
  const pending: { blob: Blob; id: number }[] = [];
  let inFlight = 0;

  const pump = () => {
    while (!stopped && inFlight < MAX_PARALLEL_UPLOADS && pending.length > 0) {
      const job = pending.shift()!;
      inFlight++;
      void runChunkUpload(job.blob, job.id).finally(() => {
        inFlight--;
        if (!stopped) pump();
      });
    }
  };

  const clearSliceArm = () => {
    if (sliceArmTimer !== null) {
      clearTimeout(sliceArmTimer);
      sliceArmTimer = null;
    }
  };

  const stop = () => {
    stopped = true;
    clearSliceArm();
    if (activeRecorder && activeRecorder.state !== "inactive") {
      try {
        activeRecorder.stop();
      } catch {
        // ignore
      }
    }
    activeRecorder = null;
    pending.length = 0;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };

  const runChunkUpload = async (
    blob: Blob,
    chunkId: number
  ): Promise<void> => {
    if (stopped || blob.size === 0) return;
    speechDiag("upload-start", { chunkId, blobBytes: blob.size });
    const formData = new FormData();
    formData.append("audio", blob);
    if (options.vocabulary?.length) {
      formData.append("phrases", JSON.stringify(options.vocabulary));
    }
    if (options.sttAliases && Object.keys(options.sttAliases).length > 0) {
      formData.append("aliases", JSON.stringify(options.sttAliases));
    }
    formData.append("lang", normalizeSpeechLocale(options.lang || "en"));

    try {
      const res = await fetchWithTimeout(
        "/api/speech-to-text",
        {
          method: "POST",
          body: formData,
        },
        CHUNK_FETCH_MS
      );
      if (stopped) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (data as { error?: string })?.error ||
          `Speech recognition failed (${res.status})`;
        console.warn("[speech-cloud]", msg);
        return;
      }
      const data = (await res.json()) as {
        transcript?: string;
        heard?: string;
        alternatives?: string[];
      };
      const fromAlts =
        Array.isArray(data?.alternatives) && data.alternatives.length > 0
          ? String(data.alternatives[0] ?? "").trim()
          : "";
      const heard =
        String(data?.heard ?? "").trim() || fromAlts;
      const transcript = String(data?.transcript ?? "").trim();
      if (!heard && !transcript) return;
      if (stopped) return;
      if (options.shouldIgnoreResults?.()) return;

      let toApply = "";
      if (transcript && chunkId >= lastAppliedSeq) {
        lastAppliedSeq = chunkId;
        toApply = transcript;
      }

      /**
       * Debug "Heard" line: prefer raw `heard`, else server `transcript`. Decoupled from
       * `onResult` arg 1 (`toApply`) so the UI updates even when the answer box stays empty.
       */
      const heardLineForUi = (heard || transcript).trim();
      if (heardLineForUi) {
        options.onHeardLine?.(heardLineForUi);
      }
      options.onResult(toApply, true);
    } catch (err) {
      if (stopped) return;
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Speech-to-text request timed out"
          : err instanceof Error
            ? err.message
            : "Speech recognition failed";
      speechDiag("upload-exception", { chunkId, msg });
      console.warn("[speech-cloud]", msg);
    }
  };

  const enqueueChunk = (blob: Blob) => {
    if (stopped || blob.size === 0) return;
    const id = ++seq;
    speechDiag("enqueue", { chunkId: id, blobBytes: blob.size });
    pending.push({ blob, id });
    pump();
  };

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      let sliceOrdinal = 0;
      const recordOneSlice = () => {
        if (stopped || !stream) return;

        const slice = ++sliceOrdinal;
        speechDiag("slice-arm", { slice, chunkMs: CHUNK_MS, mimeType });

        const mr = new MediaRecorder(stream, { mimeType });
        activeRecorder = mr;

        mr.ondataavailable = (ev) => {
          speechDiag("slice-dataavailable", { slice, bytes: ev.data.size });
          if (ev.data.size > 0) {
            enqueueChunk(ev.data);
          }
        };

        mr.onerror = () => {
          if (!stopped) options.onError?.("Recording error");
        };

        mr.onstop = () => {
          activeRecorder = null;
          clearSliceArm();
          if (!stopped) {
            setTimeout(recordOneSlice, 0);
          }
        };

        try {
          mr.start();
        } catch {
          if (!stopped) options.onError?.("Could not start recording");
          return;
        }

        sliceArmTimer = setTimeout(() => {
          sliceArmTimer = null;
          if (stopped) return;
          if (mr.state === "recording") {
            try {
              mr.stop();
            } catch {
              // ignore
            }
          }
        }, CHUNK_MS);
      };

      recordOneSlice();
    } catch (err) {
      if (stopped) return;
      const msg =
        err instanceof Error
          ? err.message
          : "Microphone access denied or not available";
      options.onError?.(msg);
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")) {
        options.onError?.("Microphone access denied.");
      }
    }
  })();

  return stop;
}

/** Check if cloud STT is likely available (we'll know for sure when we call the API) */
export function isCloudSpeechAvailable(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}
