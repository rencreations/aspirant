import { FeatureGrid, type Feature } from "@/components/feature-grid";
import { Hero } from "@/components/hero";

const features: readonly Feature[] = [
  {
    title: "Static by default",
    description:
      "next build emits plain HTML, CSS and JS to out/. Host it anywhere, including GitHub Pages.",
  },
  {
    title: "shadcn/ui + Tailwind v4",
    description:
      "A shared, themeable component library in packages/ui, consumed straight from source.",
  },
  {
    title: "The whole TanStack suite",
    description:
      "Query, Table, Form, Virtual, Store, Hotkeys, Pacer, Ranger and DB, wired into real demos.",
  },
  {
    title: "3D and motion",
    description:
      "three.js via React Three Fiber, GSAP ScrollTrigger, Motion and Lenis smooth scrolling.",
  },
  {
    title: "Production CI/CD",
    description:
      "Typecheck, ESLint, Prettier, unit and e2e tests, SBOM, Trivy, CodeQL and signed images.",
  },
  {
    title: "Hardened container",
    description:
      "Non-root nginx on Alpine with strict security headers, healthcheck and provenance.",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="mb-2 text-3xl font-semibold tracking-tight">Everything wired up</h2>
        <p className="mb-10 max-w-2xl text-muted-foreground">
          Replace this page with your own. The tooling, pipelines and libraries are already in
          place.
        </p>
        <FeatureGrid features={features} />
      </section>
    </>
  );
}
