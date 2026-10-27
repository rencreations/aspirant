import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrokenImages } from "./broken-images";

function picture(src: string) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "A picture";
  document.body.append(img);
  return img;
}

describe("BrokenImages", () => {
  it("hides a picture that fails to load, and leaves a good one alone", () => {
    const { unmount } = render(<BrokenImages />);
    const bad = picture("/missing.webp");
    const good = picture("data:image/gif;base64,R0lGODlhAQABAAAAACw=");
    bad.dispatchEvent(new Event("error"));
    expect(bad.style.visibility).toBe("hidden");
    expect(good.style.visibility).toBe("");
    unmount();
    bad.remove();
    good.remove();
  });

  it("stops listening when the page goes away", () => {
    const { unmount } = render(<BrokenImages />);
    unmount();
    const later = picture("/missing.webp");
    later.dispatchEvent(new Event("error"));
    expect(later.style.visibility).toBe("");
    later.remove();
  });
});
