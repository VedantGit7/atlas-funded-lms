/** Static BCP-47 locale codes (safe client-side reference, not backend data). */
export const COMMON_BCP47_LOCALES = [
  { value: "en", label: "English (en)" },
  { value: "en-US", label: "English — United States (en-US)" },
  { value: "en-GB", label: "English — United Kingdom (en-GB)" },
  { value: "fr", label: "French (fr)" },
  { value: "fr-FR", label: "French — France (fr-FR)" },
  { value: "de", label: "German (de)" },
  { value: "de-DE", label: "German — Germany (de-DE)" },
  { value: "es", label: "Spanish (es)" },
  { value: "es-ES", label: "Spanish — Spain (es-ES)" },
  { value: "pt", label: "Portuguese (pt)" },
  { value: "pt-BR", label: "Portuguese — Brazil (pt-BR)" },
  { value: "it", label: "Italian (it)" },
  { value: "it-IT", label: "Italian — Italy (it-IT)" },
  { value: "ja", label: "Japanese (ja)" },
  { value: "ja-JP", label: "Japanese — Japan (ja-JP)" },
  { value: "ar", label: "Arabic (ar)" },
  { value: "ar-SA", label: "Arabic — Saudi Arabia (ar-SA)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "hi-IN", label: "Hindi — India (hi-IN)" },
  { value: "zh", label: "Chinese (zh)" },
  { value: "zh-CN", label: "Chinese — China (zh-CN)" },
] as const;

export const LOCALE_CODE_PATTERN = /^[a-z]{2}([-_][A-Z]{2})?$/;

export function isValidLocaleCode(value: string): boolean {
  return LOCALE_CODE_PATTERN.test(value.trim());
}
