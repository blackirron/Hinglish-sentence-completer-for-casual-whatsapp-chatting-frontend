import { ImageResponse } from "next/og";

export const alt = "complete.io: Hinglish sentences, completed for you";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "linear-gradient(135deg,#fff6f7,#fbd9e1)", color: "#2b1820" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="96" height="96" viewBox="0 0 32 32">
            <path d="M6 5h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" fill="#a8324e" />
            <circle cx="10.5" cy="14.5" r="1.7" fill="#fff" />
            <circle cx="16" cy="14.5" r="1.7" fill="#fff" />
            <circle cx="21.5" cy="14.5" r="1.7" fill="#fff" />
          </svg>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
            complete<span style={{ color: "#a8324e" }}>.io</span>
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>Complete your thoughts in Hinglish</div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: "#7a6169" }}>Runs on your device. Your text never leaves your browser.</div>
      </div>
    ),
    size,
  );
}
