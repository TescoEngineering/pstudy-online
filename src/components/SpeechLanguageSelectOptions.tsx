import { SPEECH_LANGUAGES } from "@/lib/speech-languages";

/** Same option list as Practice → Speech language (plus optional blank and other). */
export function SpeechLanguageSelectOptions({
  includeEmpty,
  includeOther,
  otherLabel,
}: {
  includeEmpty?: boolean;
  includeOther?: boolean;
  otherLabel?: string;
}) {
  return (
    <>
      {includeEmpty ? (
        <option value="">—</option>
      ) : null}
      {SPEECH_LANGUAGES.map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
      {includeOther && otherLabel ? (
        <option value="other">{otherLabel}</option>
      ) : null}
    </>
  );
}
