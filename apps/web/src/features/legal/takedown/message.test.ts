import { describe, expect, it } from "vitest";

import { OPERATOR } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

import {
  buildBody,
  gmailHref,
  mailtoHref,
  missingFields,
  outlookHref,
  subjectFor,
  type TakedownForm,
} from "./message";
import { cleanPage, itemsFromParams, takedownHref } from "./prefill";

const form: TakedownForm = {
  name: "Dewi Lestari",
  role: "owner",
  items: "Moonlit Layla (item fanart-12)\nhttps://aspirant.cc/collection/arts/fanart/?i=fanart-12",
  statement: "I drew this. I did not give permission.",
};

describe("the message", () => {
  it("names the item, the sender, the reason and the date, and signs it", () => {
    const body = buildBody(form, "2026-11-12");
    expect(body).toContain("Moonlit Layla (item fanart-12)");
    expect(body).toContain("From: Dewi Lestari (I own the rights)");
    expect(body).toContain("I drew this. I did not give permission.");
    expect(body).toContain("in good faith");
    expect(body).toContain("Signed: Dewi Lestari");
    expect(body).toContain("Date: 2026-11-12");
  });

  it("changes the declaration with the role", () => {
    expect(buildBody({ ...form, role: "person" }, "d")).toContain("I am the person shown");
    expect(buildBody({ ...form, role: "person" }, "d")).not.toContain("in good faith");
    expect(buildBody({ ...form, role: "agent" }, "d")).toContain("authorised to act for the owner");
  });

  it("takes the subject from the first line of the item, cut when it is long", () => {
    expect(subjectFor(form)).toBe("Takedown request: Moonlit Layla (item fanart-12)");
    expect(subjectFor({ ...form, items: "" })).toBe("Takedown request");
    const long = subjectFor({ ...form, items: "x".repeat(200) });
    expect(long.length).toBeLessThan(100);
    expect(long.endsWith("...")).toBe(true);
  });

  it("is addressed to the operator, and the three links carry the same message", () => {
    for (const href of [mailtoHref(form, "d"), gmailHref(form, "d"), outlookHref(form, "d")]) {
      expect(href).toContain(encodeURIComponent("Takedown request: Moonlit Layla"));
    }
    expect(mailtoHref(form, "d").startsWith(`mailto:${OPERATOR.email}?`)).toBe(true);
    expect(gmailHref(form, "d")).toContain(encodeURIComponent(OPERATOR.email));
    expect(outlookHref(form, "d")).toContain(encodeURIComponent(OPERATOR.email));
    expect(gmailHref(form, "d").startsWith("https://mail.google.com/")).toBe(true);
    expect(outlookHref(form, "d").startsWith("https://outlook.live.com/")).toBe(true);
  });

  it("asks for what is missing", () => {
    expect(missingFields(form)).toEqual([]);
    expect(missingFields({ ...form, name: " ", statement: "" })).toEqual([
      "your name",
      "the reason",
    ]);
  });
});

describe("the link from an item", () => {
  it("carries the id, the title and the page, and nothing else", () => {
    const href = takedownHref(
      { id: "fanart-12", title: "Moonlit Layla" },
      "/collection/arts/fanart/",
    );
    expect(href).toBe(
      "/takedown?item=fanart-12&title=Moonlit+Layla&page=%2Fcollection%2Farts%2Ffanart%2F%3Fi%3Dfanart-12",
    );
  });

  it("works for an item with no id", () => {
    expect(takedownHref({ title: "A drawing" }, "/character/vexana/")).toBe(
      "/takedown?title=A+drawing&page=%2Fcharacter%2Fvexana%2F",
    );
  });

  it("is read back into the form text", () => {
    const params = new URLSearchParams(
      "item=fanart-12&title=Moonlit+Layla&page=%2Fcollection%2Farts%2Ffanart%2F%3Fi%3Dfanart-12",
    );
    expect(itemsFromParams((key) => params.get(key))).toBe(
      `Moonlit Layla (item fanart-12)\n${siteConfig.url}/collection/arts/fanart/?i=fanart-12`,
    );
    expect(itemsFromParams(() => null)).toBe("");
  });

  it("drops a page that is not a path of this site", () => {
    expect(cleanPage("https://evil.example/x")).toBe("");
    expect(cleanPage("//evil.example/x")).toBe("");
    expect(cleanPage("/ok/path/?i=a-1")).toBe("/ok/path/?i=a-1");
    expect(cleanPage("/has space")).toBe("");
    expect(cleanPage("/<script>")).toBe("");
  });
});
