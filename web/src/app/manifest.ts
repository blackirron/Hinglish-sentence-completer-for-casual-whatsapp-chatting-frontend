import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "complete.io",
    short_name: "complete.io",
    description: "Hinglish sentences, completed for you.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff6f7",
    theme_color: "#a8324e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
