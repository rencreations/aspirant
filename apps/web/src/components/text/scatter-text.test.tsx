import { render, screen } from "@testing-library/react";

import { ScatterText } from "./scatter-text";

describe("ScatterText", () => {
  it("keeps the full text for assistive tech and hides the letter spans", () => {
    const { container } = render(<ScatterText text="The Aspirants" as="h2" />);
    expect(screen.getByRole("heading", { level: 2, name: "The Aspirants" })).toBeInTheDocument();
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden?.querySelectorAll("[data-letter]")).toHaveLength("The Aspirants".length);
  });
});
