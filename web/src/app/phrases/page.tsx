import type { Metadata } from "next";
import { PhrasesView } from "@/components/history/phrases-view";

export const metadata: Metadata = { title: "My phrases" };

export default function PhrasesPage() {
  return <PhrasesView />;
}
