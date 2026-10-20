import type { Metadata } from "next";
import { ExamplesView } from "@/components/examples/examples-view";

export const metadata: Metadata = { title: "Examples" };

export default function ExamplesPage() {
  return <ExamplesView />;
}
