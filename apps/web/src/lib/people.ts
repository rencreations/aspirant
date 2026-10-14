type Status = "active" | "away" | "offline";

export interface Person {
  id: number;
  name: string;
  role: string;
  team: string;
  salary: number;
  joined: string;
  status: Status;
}

const FIRST = [
  "Ava",
  "Noah",
  "Mia",
  "Liam",
  "Zoe",
  "Eli",
  "Ivy",
  "Kai",
  "Nia",
  "Omar",
  "Rin",
  "Sam",
];
const LAST = [
  "Chen",
  "Okafor",
  "Silva",
  "Novak",
  "Haddad",
  "Tanaka",
  "Reyes",
  "Larsen",
  "Singh",
  "Moreau",
];
const ROLES = ["Engineer", "Designer", "Product", "Data", "Support", "Security"];
const TEAMS = ["Platform", "Growth", "Core", "Studio", "Labs"];
const STATUSES: Status[] = ["active", "away", "offline"];

/** Small deterministic PRNG so the dataset is identical on every render and in tests. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)] as T;
}

export function generatePeople(count = 2000, seed = 42): Person[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => {
    const day = 1 + Math.floor(rand() * 28);
    const month = 1 + Math.floor(rand() * 12);
    const year = 2018 + Math.floor(rand() * 8);
    return {
      id: i + 1,
      name: `${pick(rand, FIRST)} ${pick(rand, LAST)}`,
      role: pick(rand, ROLES),
      team: pick(rand, TEAMS),
      salary: 60 + Math.floor(rand() * 140),
      joined: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      status: pick(rand, STATUSES),
    };
  });
}

/** Simulates a network round-trip so loading states are visible. */
export async function fetchPeople(): Promise<Person[]> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return generatePeople();
}
