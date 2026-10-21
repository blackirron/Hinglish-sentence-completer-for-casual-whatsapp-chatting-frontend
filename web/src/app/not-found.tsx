import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">That page does not exist</h1>
      <p className="mt-2 text-muted">The link may be old or mistyped. Let us get you back to writing.</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
        Back to home
      </Link>
    </div>
  );
}
