import type { Metadata } from "next";

import { DataLab } from "@/components/data-lab";

export const metadata: Metadata = {
  title: "Data lab",
  description:
    "TanStack Query, DB, Table, Virtual, Form, Store, Hotkeys, Pacer and Ranger working together.",
};

export default function DataPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="mb-2 text-4xl font-semibold tracking-tight">Data lab</h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        A client-side playground for the TanStack ecosystem. All data is generated locally.
      </p>
      <DataLab />
    </section>
  );
}
