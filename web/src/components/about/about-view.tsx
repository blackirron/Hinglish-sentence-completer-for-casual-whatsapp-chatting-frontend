import Link from "next/link";
import { ArrowRight, Cpu, Gauge, ShieldCheck, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { GithubIcon } from "@/components/icons/github-icon";
import { Card } from "@/components/ui/primitives";

const REPO = "https://github.com/blackirron/Hinglish-sentence-completer-for-casual-whatsapp-chatting";

const FACTS = [
  { label: "Base model", value: "l3cube-pune/hing-gpt" },
  { label: "Fine tuned on", value: "Casual Hinglish chat text" },
  { label: "Eval perplexity", value: "10.79" },
  { label: "Vocabulary", value: "30,523 tokens" },
];

export function AboutView() {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <LogoMark className="h-12 w-12 text-primary" />
        <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          complete<span className="text-primary">.io</span>, Hinglish sentences completed for you
        </h1>
        <p className="max-w-2xl text-base text-muted">
          Type the start of a message the way you would text it. A small GPT-2 model, fine tuned on casual Hinglish, suggests the next word and finishes the sentence. It is a student project, built to see how far a small model can go on real chat style text.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            Try it now <ArrowRight className="h-4 w-4" />
          </Link>
          <a href={REPO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:border-primary hover:text-primary">
            <GithubIcon className="h-4 w-4" /> View on GitHub
          </a>
        </div>
      </section>

      <section aria-labelledby="facts">
        <h2 id="facts" className="mb-3 flex items-center gap-2 text-sm font-bold"><Cpu className="h-4 w-4 text-primary" />The model</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f) => (
            <Card key={f.label} className="p-4">
              <dt className="text-xs font-medium text-muted">{f.label}</dt>
              <dd className="mt-1 text-sm font-semibold">{f.value}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section aria-labelledby="how" className="grid gap-5 lg:grid-cols-3">
        <Card>
          <h2 id="how" className="mb-2 flex items-center gap-2 text-sm font-bold"><Gauge className="h-4 w-4 text-primary" />How it works</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            <li>You type a half message.</li>
            <li>Our server checks and cleans the text, then asks the model server.</li>
            <li>The model ranks next words or samples a few endings.</li>
            <li>You pick, edit and copy. Nothing is sent to anyone else.</li>
          </ol>
        </Card>
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><TriangleAlert className="h-4 w-4 text-primary" />Honest limits</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>It is a small model. Some lines will be odd, repetitive or off topic.</li>
            <li>It has no real control over tone. Creativity only changes how adventurous the word choice is.</li>
            <li>Hindi in Devanagari is not live yet. It needs its own model.</li>
            <li>Because it learned from casual chat text, it can echo rude or biased phrasing. Read before you send.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" />Privacy and security</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
            <li>No accounts and no tracking scripts.</li>
            <li>Your text is used for one request and is not stored or logged on the server.</li>
            <li>History and saved phrases stay in your browser and you can erase them in Settings.</li>
            <li>The model server only accepts calls from this site, with rate limits and size limits.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
