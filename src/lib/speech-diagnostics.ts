/**
 * Browser-only diagnostics for cloud speech (MediaRecorder → STT).
 *
 * Enable in DevTools console on localhost:
 *   localStorage.setItem("pstudySpeechDebug", "1")
 * Reload the practice page, watch console for [pstudy-speech] lines.
 * Disable:
 *   localStorage.removeItem("pstudySpeechDebug")
 *
 * What to look for when “only the first ~1.2s works”:
 * - chunk.bytes: second and later slices should be non-zero if the mic is capturing.
 * - stt.http / stt.transcriptLen: if bytes > 0 but transcript always empty after slice 1, the API/codec is the bottleneck; if bytes === 0, the recorder isn’t emitting audio for later slices.
 */

export function isSpeechDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("pstudySpeechDebug") === "1";
  } catch {
    return false;
  }
}

export function speechDiag(phase: string, data: Record<string, unknown>): void {
  if (!isSpeechDiagnosticsEnabled()) return;
  console.info(`[pstudy-speech] ${phase}`, { wallMs: Date.now(), ...data });
}
