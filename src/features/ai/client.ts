import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env } from "@/lib/env.server";
import { reserveAiCall } from "./budget";
import { parseModels } from "./domain/policy";
import { createAi, type GeminiModels } from "./gemini";

let models: GeminiModels | null | undefined;

/** The SDK client, created on first use; null without `GEMINI_API_KEY`. */
function client(): GeminiModels | null {
  if (models === undefined) {
    models = env.GEMINI_API_KEY
      ? new GoogleGenAI({
          apiKey: env.GEMINI_API_KEY,
          // E2E points this at tests/e2e/fake-gemini.ts.
          ...(env.GEMINI_BASE_URL && {
            httpOptions: { baseUrl: env.GEMINI_BASE_URL },
          }),
        }).models
      : null;
  }
  return models;
}

/** The app's Gemini wrapper: models from env, gate = kill switch + budget. */
export const ai = createAi({
  client,
  models: {
    text: parseModels(env.GEMINI_MODEL_TEXT),
    import: parseModels(env.GEMINI_MODEL_IMPORT),
  },
  gate: () => reserveAiCall(),
});
