import { generatePeople } from "./people";

describe("generatePeople", () => {
  it("returns the requested number of people", () => {
    expect(generatePeople(25)).toHaveLength(25);
  });

  it("is deterministic for a given seed", () => {
    expect(generatePeople(10, 7)).toEqual(generatePeople(10, 7));
    expect(generatePeople(10, 7)).not.toEqual(generatePeople(10, 8));
  });

  it("produces unique ids and well-formed dates", () => {
    const people = generatePeople(200);
    expect(new Set(people.map((p) => p.id)).size).toBe(200);
    for (const p of people) expect(p.joined).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
