import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const inBrowser = process.env.NEXT_PUBLIC_ENGINE !== "server";
const localModel = process.env.NEXT_PUBLIC_MODEL_SOURCE === "local";

// In browser mode the model files come from the Hugging Face Hub, so connect-src names it and
// nothing else. In server mode (or with a local test model) connect-src stays on our own origin.
const hub = inBrowser && !localModel ? ["https://huggingface.co", "https://*.huggingface.co", "https://*.hf.co"] : [];

// Next.js and next-themes need inline bootstrap scripts, so script-src allows 'unsafe-inline'
// (a nonce would force every page to render dynamically and lose static caching).
// 'wasm-unsafe-eval' lets WebAssembly compile, it does not allow eval of strings.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${hub.join(" ")}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Same origin plus credentialless makes the page cross origin isolated, which unlocks
  // multi threaded WebAssembly (a good speed up) without breaking cross origin model downloads.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
