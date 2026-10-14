import { render, screen } from "@testing-library/react";

import { FeatureGrid } from "./feature-grid";

describe("FeatureGrid", () => {
  it("renders every feature title and description", () => {
    render(
      <FeatureGrid
        features={[
          { title: "Static export", description: "Ships as plain files." },
          { title: "Container", description: "Served by nginx." },
        ]}
      />,
    );
    expect(screen.getByText("Static export")).toBeInTheDocument();
    expect(screen.getByText("Served by nginx.")).toBeInTheDocument();
  });
});
