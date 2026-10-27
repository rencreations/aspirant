// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteError } from "./route-error";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RouteError", () => {
  it("shows a calm message with three ways out, and builds the page again on request", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    render(<RouteError error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/stumbled/i);
    expect(screen.queryByText(/boom/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "All Aspirants" }).getAttribute("href")).toBe(
      "/character",
    );
  });
});
