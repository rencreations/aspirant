import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContactForm, contactSchema } from "./contact-form";

describe("contactSchema", () => {
  it("accepts valid input", () => {
    expect(
      contactSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        message: "Hello there, friend.",
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid email and a short message", () => {
    const result = contactSchema.safeParse({ name: "Ada", email: "nope", message: "hi" });
    expect(result.success).toBe(false);
  });
});

describe("ContactForm", () => {
  it("shows a validation error after touching an invalid field", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);
    const email = screen.getByLabelText("Email");
    await user.type(email, "not-an-email");
    await user.tab();
    expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
  });
});
