/** Public address of the site, set NEXT_PUBLIC_SITE_URL on Vercel (for example https://complete-io.vercel.app). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
