export const siteConfig = {
  name: "Aspirant",
  tagline: "Interactive, static, production-ready.",
  description:
    "A statically exported Next.js site with shadcn/ui, TanStack, three.js, GSAP and Motion, shipped to GitHub Pages and GHCR.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
} as const;

export const navItems = [
  { href: "/", label: "Home" },
  { href: "/ui", label: "UI kit" },
  { href: "/data", label: "Data lab" },
] as const;
