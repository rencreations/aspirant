import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { HoverCard } from "./hover-card";

describe("HoverCard", () => {
  it("opens on keyboard focus, describes the trigger, and closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <p>
        In Tanner&apos;s Row, <HoverCard card={<span>Layla, Miss Hikari.</span>}>Layla</HoverCard>{" "}
        waits.
      </p>,
    );
    const trigger = screen.getByRole("button", { name: "Layla" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.tab();
    expect(trigger).toHaveFocus();
    const card = await screen.findByRole("tooltip");
    expect(card).toHaveTextContent("Layla, Miss Hikari.");
    expect(trigger).toHaveAttribute("aria-describedby", card.id);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
