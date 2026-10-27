import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";
import GlobalError from "./global-error";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the error pages", () => {
  it("offers a retry and a plain way home when a page throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    const home = screen.getByRole("link", { name: "Back to the archive" });
    expect(home.getAttribute("href")).toMatch(/\/$/);
  });

  it("says nothing technical to the visitor", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorPage error={new Error("Cannot read properties of undefined")} reset={vi.fn()} />);
    expect(document.body.textContent).not.toMatch(/Cannot read|undefined|stack/i);
  });

  it("carries its own page when the layout failed", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // The test renders into a div, so only the content of <html> is checked.
    const { container } = render(<GlobalError error={new Error("layout")} reset={vi.fn()} />);
    expect(container.textContent).toMatch(/Reload/);
    expect(container.textContent).toMatch(/Back to the archive/);
  });
});
