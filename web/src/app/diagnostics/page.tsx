import type { Metadata } from "next";
import { DiagnosticsView } from "@/components/diagnostics/diagnostics-view";

export const metadata: Metadata = { title: "Model check", robots: { index: false, follow: false } };

export default function DiagnosticsPage() {
  return <DiagnosticsView />;
}
