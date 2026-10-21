import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";

export const metadata: Metadata = { title: "Your completions" };

export default function ResultsPage() {
  return <ResultsView />;
}
