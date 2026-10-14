"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@aspirant/ui/components/card";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface Feature {
  title: string;
  description: string;
}

export function FeatureGrid({ features }: { features: readonly Feature[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-feature]", {
          opacity: 0,
          y: 40,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root.current, start: "top 80%" },
        });
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <Card key={feature.title} data-feature>
          <CardHeader>
            <CardTitle>{feature.title}</CardTitle>
            <CardDescription>{feature.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
