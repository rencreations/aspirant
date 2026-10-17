import type { Metadata } from "next";

import { Harness } from "./harness";

export const metadata: Metadata = {
  title: "Scenes dev",
  description: "Development harness for the Experience scenes.",
  robots: { index: false, follow: false },
};

export default function ScenesDevPage() {
  return <Harness />;
}
