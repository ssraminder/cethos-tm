import type { MtRequest, MtSuggestion } from "./index";

// Map BCP-47 → DeepL lang codes (DeepL is picky about target variants).
const SRC_MAP: Record<string, string> = {
  "en-US": "EN", "en-GB": "EN", "en": "EN",
  "fr-FR": "FR", "fr-CA": "FR", "fr": "FR",
  "es-ES": "ES", "es-MX": "ES", "es": "ES",
  "de-DE": "DE", "de": "DE",
  "ja-JP": "JA", "ja": "JA",
  "zh-CN": "ZH", "zh-TW": "ZH",
  "it-IT": "IT", "it": "IT",
  "pt-BR": "PT-BR", "pt-PT": "PT-PT", "pt": "PT-BR",
  "ru-RU": "RU", "ru": "RU",
  "nl-NL": "NL", "nl": "NL",
  "pl-PL": "PL", "pl": "PL",
  "ko-KR": "KO", "ko": "KO",
  "tr-TR": "TR", "tr": "TR",
  "sv-SE": "SV", "sv": "SE",
};
const TGT_MAP: Record<string, string> = {
  ...SRC_MAP,
  "en-US": "EN-US", "en-GB": "EN-GB", "en": "EN-US",
};

export async function translateWithDeepl(req: MtRequest): Promise<MtSuggestion> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY not set");
  const baseUrl = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";

  const src = SRC_MAP[req.source_lang] ?? req.source_lang.toUpperCase().split("-")[0];
  const tgt = TGT_MAP[req.target_lang] ?? req.target_lang.toUpperCase();

  const params = new URLSearchParams();
  params.set("text", req.source_text);
  params.set("source_lang", src);
  params.set("target_lang", tgt);
  params.set("preserve_formatting", "1");

  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: "POST",
    headers: {
      "Authorization": `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DeepL ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { translations: Array<{ text: string; detected_source_language?: string }> };
  const t = data.translations?.[0];
  if (!t) throw new Error("DeepL returned no translations");
  return { engine: "deepl", target_text: t.text, detected_source_lang: t.detected_source_language };
}
