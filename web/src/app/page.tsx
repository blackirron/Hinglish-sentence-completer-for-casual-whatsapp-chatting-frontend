import { Composer } from "@/components/home/composer";

export default function HomePage() {
  return (
    <div>
      <section className="mb-8">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Complete your thoughts in <span className="text-primary">Hinglish</span>
        </h1>
        <p className="mt-3 max-w-xl text-base text-muted">Turn your half typed message into natural, chat friendly Hinglish.</p>
      </section>
      <Composer />
    </div>
  );
}
