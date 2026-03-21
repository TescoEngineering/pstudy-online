/**
 * Google Cloud Speech-to-Text client.
 * Records audio from the microphone, sends chunks to our API with phrase hints.
 * Use when "Consider only deck answers" is enabled for much better accuracy.
 */

export type CloudSpeechOptions = {
  lang?: string;
  vocabulary?: string[];
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
};

/** Map BCP-47 to Google language code (e.g. en -> en-US) */
function toGoogleLang(bcp: string): string {
  const normalized = bcp.trim().toLowerCase();
  if (normalized.length <= 2) {
    const map: Record<string, string> = {
      en: "en-US",
      es: "es-ES",
      fr: "fr-FR",
      de: "de-DE",
      it: "it-IT",
      pt: "pt-BR",
      nl: "nl-NL",
      pl: "pl-PL",
      ru: "ru-RU",
      ja: "ja-JP",
      zh: "zh-CN",
      ko: "ko-KR",
      ar: "ar-SA",
      hi: "hi-IN",
      tr: "tr-TR",
      sv: "sv-SE",
      da: "da-DK",
      fi: "fi-FI",
      el: "el-GR",
    };
    return map[normalized] ?? `${normalized}-${normalized.toUpperCase()}`;
  }
  return bcp;
}

/**
 * Start cloud-based speech recognition.
 * Records in 2-second chunks, sends to API with phrase hints.
 * Returns a stop function, or null if not available (no mic, etc.).
 */
export function startCloudListening(
  options: CloudSpeechOptions
): (() => void) | null {
  if (typeof window === "undefined") return null;

  let stopped = false;
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;

  const stop = () => {
    stopped = true;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {
        // ignore
      }
      mediaRecorder = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  };

  const sendChunk = async (blob: Blob) => {
    if (stopped || blob.size < 100) return; // Skip tiny chunks
    const formData = new FormData();
    formData.append("audio", blob);
    if (options.vocabulary?.length) {
      formData.append("phrases", JSON.stringify(options.vocabulary));
    }
    formData.append("lang", toGoogleLang(options.lang || "en"));

    try {
      const res = await fetch("/api/speech-to-text", {
        method: "POST",
        body: formData,
      });
      if (stopped) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.error || `Speech recognition failed (${res.status})`;
        options.onError?.(msg);
        return;
      }
      const data = (await res.json()) as { transcript?: string };
      const transcript = String(data?.transcript ?? "").trim();
      if (transcript) {
        options.onResult(transcript, true);
      }
    } catch (err) {
      if (stopped) return;
      options.onError?.(
        err instanceof Error ? err.message : "Speech recognition failed"
      );
    }
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
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      const CHUNK_MS = 2000;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          sendChunk(e.data);
        }
      };

      mediaRecorder.onerror = () => {
        if (!stopped) options.onError?.("Recording error");
      };

      mediaRecorder.start(CHUNK_MS);
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
