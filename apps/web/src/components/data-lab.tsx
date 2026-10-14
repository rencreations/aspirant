"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { useLiveQuery } from "@tanstack/react-db";
import { and, gte, ilike, inArray, lte } from "@tanstack/db";
import { useSelector } from "@tanstack/react-store";
import { useRef, useState } from "react";

import { Badge } from "@aspirant/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@aspirant/ui/components/card";
import { Input } from "@aspirant/ui/components/input";
import { Label } from "@aspirant/ui/components/label";
import { Skeleton } from "@aspirant/ui/components/skeleton";

import { PeopleTable } from "@/components/people-table";
import { RangeSlider } from "@/components/range-slider";
import { VirtualList } from "@/components/virtual-list";
import { generatePeople, type Person } from "@/lib/people";
import { peopleCollection } from "@/lib/people-collection";
import { activityStore, logActivity } from "@/stores/activity-store";

const ROLES = ["Engineer", "Designer", "Product", "Data", "Support", "Security"] as const;

async function fetchStats() {
  await new Promise((resolve) => setTimeout(resolve, 250));
  const people = generatePeople();
  const total = people.reduce((sum, p) => sum + p.salary, 0);
  return {
    count: people.length,
    averageSalary: Math.round(total / people.length),
    active: people.filter((p) => p.status === "active").length,
  };
}

export function DataLab() {
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [roles, setRoles] = useState<readonly string[]>(ROLES);
  const [salary, setSalary] = useState<[number, number]>([60, 200]);

  // TanStack Pacer: debounce the search term before it hits the live query.
  const [debouncedSearch] = useDebouncedValue(search, { wait: 250 });

  // TanStack Hotkeys: Cmd/Ctrl+K focuses search, Escape clears it.
  useHotkey("Mod+K", (event) => {
    event.preventDefault();
    searchRef.current?.focus();
    logActivity("Focused search with Mod+K");
  });
  useHotkey("Escape", () => setSearch(""), { target: searchRef });

  // TanStack Query: a small, persisted summary query.
  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats });

  // TanStack DB: live query over a query-backed collection.
  const { data: rows, isLoading } = useLiveQuery(
    (q) =>
      q
        .from({ person: peopleCollection })
        .where(({ person }) => ilike(person.name, `%${debouncedSearch}%`))
        .where(({ person }) => inArray(person.role, [...roles]))
        .where(({ person }) => and(gte(person.salary, salary[0]), lte(person.salary, salary[1])))
        .orderBy(({ person }) => person.id, "asc"),
    [debouncedSearch, roles, salary],
  );

  // TanStack Store: reactive activity log.
  const activity = useSelector(activityStore, (s) => s);

  const people = (rows ?? []) as Person[];

  function toggleRole(role: string) {
    setRoles((current) =>
      current.includes(role) ? current.filter((r) => r !== role) : [...current, role],
    );
    logActivity(`Toggled role filter: ${role}`);
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["People", stats.data?.count],
            ["Average salary", stats.data ? `$${stats.data.averageSalary}k` : undefined],
            ["Active now", stats.data?.active],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">
                {value ?? <Skeleton className="h-8 w-24" />}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Press <kbd className="rounded border px-1 font-mono text-xs">Ctrl/⌘ K</kbd> to focus
            search.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="search">Search by name</Label>
            <Input
              id="search"
              ref={searchRef}
              type="search"
              placeholder="e.g. Ava"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>
              Salary: ${salary[0]}k – ${salary[1]}k
            </Label>
            <RangeSlider
              min={60}
              max={200}
              step={5}
              values={salary}
              onChange={setSalary}
              label="Salary"
            />
          </div>
          <div
            className="flex flex-wrap gap-2 md:col-span-2"
            role="group"
            aria-label="Role filters"
          >
            {ROLES.map((role) => (
              <button
                key={role}
                type="button"
                aria-pressed={roles.includes(role)}
                onClick={() => toggleRole(role)}
                className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Badge variant={roles.includes(role) ? "default" : "outline"}>{role}</Badge>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sortable table</CardTitle>
            <CardDescription>TanStack Table v9 over a TanStack DB live query.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-2" aria-busy="true" aria-label="Loading people">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <PeopleTable data={people} />
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>TanStack Store</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Interact with the filters.</p>
              ) : (
                <ul className="grid gap-1 text-sm" aria-live="polite">
                  {activity.map((entry) => (
                    <li key={entry.id} className="text-muted-foreground">
                      {entry.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Virtualized list</CardTitle>
              <CardDescription>{people.length} rows, ~20 in the DOM.</CardDescription>
            </CardHeader>
            <CardContent>
              <VirtualList items={people} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
