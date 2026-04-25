import type { MtRequest, MtSuggestion } from "./index";

/**
 * Deterministic mock translation engine. Used when no MT API keys are
 * configured. The output is obviously synthetic so reviewers don't mistake
 * it for a real translation.
 */
export async function translateWithMock(req: MtRequest): Promise<MtSuggestion> {
  return {
    engine: "mock",
    target_text: `[MT-mock ${req.source_lang}→${req.target_lang}] ${req.source_text}`,
    warning: "Mock engine — configure DEEPL_API_KEY or GOOGLE_TRANSLATE_API_KEY for real machine translation.",
  };
}
