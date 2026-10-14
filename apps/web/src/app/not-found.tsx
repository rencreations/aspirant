import Link from "next/link";

import { Button } from "@aspirant/ui/components/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-32 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">
        The page you are looking for does not exist or has moved.
      </p>
      <Button asChild>
        <Link href="/">Back home</Link>
      </Button>
    </section>
  );
}
