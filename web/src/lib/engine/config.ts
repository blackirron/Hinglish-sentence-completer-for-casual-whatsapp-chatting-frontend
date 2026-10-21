// Build time settings. NEXT_PUBLIC_ values are inlined, so they are public by design.
export const MODEL_ID = process.env.NEXT_PUBLIC_MODEL_ID || "blackirron/hinglish-gpt2-onnx";
/** Pin to a commit hash in production so a later push to the model repo cannot change behaviour. */
export const MODEL_REVISION = process.env.NEXT_PUBLIC_MODEL_REVISION || "8357f2d52850e525f41b35d7f49e44d1dd066c19";
/** "local" serves the model from /models on this site (used for tests), otherwise the Hugging Face Hub. */
export const MODEL_SOURCE = process.env.NEXT_PUBLIC_MODEL_SOURCE === "local" ? "local" : "hub";
export const BLOCKLIST: readonly string[] = (process.env.NEXT_PUBLIC_BLOCKLIST_WORDS ?? "")
  .split(",")
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);
export const ENGINE_MODE = process.env.NEXT_PUBLIC_ENGINE === "server" ? "server" : "browser";
export const APPROX_DOWNLOAD_MB = 112;
