import { translateWithDeepl } from "./deepl";
import { translateWithGoogle } from "./google";
import { translateWithMock } from "./mock";

export type MtEngineKind = "deepl" | "google" | "mock";

export interface MtSuggestion {
  engine: MtEngineKind;
  target_text: string;
  detected_source_lang?: string;
  warning?: string;
}

export interface MtRequest {
  source_text: string;
  source_lang: string;
  target_lang: string;
}

export function getDefaultEngine(): MtEngineKind {
  const k = (process.env.MT_DEFAULT_ENGINE || "").toLowerCase();
  if (k === "deepl" && process.env.DEEPL_API_KEY) return "deepl";
  if (k === "google" && process.env.GOOGLE_TRANSLATE_API_KEY) return "google";
  if (process.env.DEEPL_API_KEY) return "deepl";
  if (process.env.GOOGLE_TRANSLATE_API_KEY) return "google";
  return "mock";
}

export async function translate(req: MtRequest, engine?: MtEngineKind): Promise<MtSuggestion> {
  const choice = engine ?? getDefaultEngine();
  switch (choice) {
    case "deepl":  return translateWithDeepl(req);
    case "google": return translateWithGoogle(req);
    case "mock":   return translateWithMock(req);
  }
}
