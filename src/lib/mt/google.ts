import type { MtRequest, MtSuggestion } from "./index";

function shorten(lang: string): string {
  // Google v2 accepts BCP-47 but prefers language subtag for many pairs.
  return lang.split("-")[0];
}

export async function translateWithGoogle(req: MtRequest): Promise<MtSuggestion> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new Error("GOOGLE_TRANSLATE_API_KEY not set");
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: req.source_text,
      source: shorten(req.source_lang),
      target: shorten(req.target_lang),
      format: "text",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data: { translations: Array<{ translatedText: string; detectedSourceLanguage?: string }> } };
  const t = data.data?.translations?.[0];
  if (!t) throw new Error("Google returned no translation");
  return { engine: "google", target_text: t.translatedText, detected_source_lang: t.detectedSourceLanguage };
}
