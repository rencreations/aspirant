import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
        <p>Built with Next.js, shadcn/ui, TanStack, three.js, GSAP and Motion.</p>
      </div>
    </footer>
  );
}
