import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_READY } from "./constants";
import Loader from "./Loader";

// jsdom has no WebGL, so the loader takes its static path, which is what these tests cover.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Loader", () => {
  it("names the page and falls back to the static title without WebGL", async () => {
    const { container } = render(<Loader onEnter={() => undefined} />);
    expect(screen.getByRole("heading", { level: 1, name: "The Aspirants" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("data-renderer", "static");
    expect(screen.getByRole("progressbar", { name: "Loading the archive" })).toBeInTheDocument();
    // Let the font check settle inside act so its state update is accounted for.
    await act(() => Promise.resolve());
  });

  it("announces when loaded and moves focus to the button", async () => {
    render(<Loader onEnter={() => undefined} />);
    const button = screen.getByRole("button", { name: "Enter the archive" });
    await waitFor(() => expect(screen.getByText(LIVE_READY)).toBeInTheDocument(), {
      timeout: 6000,
    });
    await waitFor(() => expect(button).toHaveFocus(), { timeout: 3000 });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  }, 15_000);

  it("activates inside the click and calls onEnter exactly once", async () => {
    const onEnter = vi.fn();
    const onActivate = vi.fn();
    render(<Loader onEnter={onEnter} onActivate={onActivate} />);
    const skip = screen.getByRole("button", { name: "Skip" });
    act(() => {
      fireEvent.click(skip);
      fireEvent.click(skip);
      fireEvent.click(screen.getByRole("button", { name: "Enter the archive" }));
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onEnter).not.toHaveBeenCalled();
    await waitFor(() => expect(onEnter).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
