import type { Metadata } from "next";

import { UiShowcase } from "@/components/ui-showcase";

export const metadata: Metadata = {
  title: "UI kit",
  description: "shadcn/ui components, Radix primitives and TanStack Form in one place.",
};

export default function UiPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="mb-2 text-4xl font-semibold tracking-tight">UI kit</h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        Components live in <code className="font-mono text-sm">packages/ui</code> and are shared
        across apps.
      </p>
      <UiShowcase />
    </section>
  );
}
