"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useQueryState } from "@/features/library/use-query-state";
import { useMounted } from "@/lib/hooks";
import { OPERATOR } from "@/lib/legal";

import {
  MAILTO_SAFE_LENGTH,
  ROLES,
  buildBody,
  gmailHref,
  mailtoHref,
  missingFields,
  outlookHref,
  subjectFor,
  type Role,
  type TakedownForm,
} from "./message";
import { itemsFromParams } from "./prefill";
import styles from "./takedown.module.css";

const HINTS: Record<Role, string> = {
  owner: "Say how you own it, for example that you drew or took it, and link to your original.",
  agent: "Say who you act for and how, and link to the original.",
  person: "Say which picture shows you and that you ask for it to be removed.",
  other: "Say why it should not be shown here.",
};

/**
 * Writes the takedown message. The site has no server, so nothing is sent from this page: the
 * visitor presses one button and their own email app (or Gmail, or Outlook on the web) opens with
 * the message ready, or copies it and pastes it anywhere. There is no email or phone field: the
 * mail they send carries the address we reply to. It is built from `div`s and buttons on purpose,
 * not a `form`, and none of what is typed goes in the address.
 */
export function TakedownComposer() {
  const mounted = useMounted();
  const [item] = useQueryState("item");
  const [title] = useQueryState("title");
  const [page] = useQueryState("page");

  const prefill = useMemo(() => {
    const values: Record<string, string> = { item, title, page };
    return itemsFromParams((key) => {
      const value = values[key];
      return value === undefined || value === "" ? null : value;
    });
  }, [item, title, page]);

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("owner");
  const [items, setItems] = useState("");
  const [statement, setStatement] = useState("");
  const [copied, setCopied] = useState(false);
  const touched = useRef(false);

  // The link that brought the visitor names the item. It fills the box until they edit it.
  useEffect(() => {
    if (!touched.current && prefill) setItems(prefill);
  }, [prefill]);

  const form: TakedownForm = { name, role, items, statement };
  const missing = missingFields(form);
  const ready = missing.length === 0;
  const today = new Date().toISOString().slice(0, 10);
  const body = mounted ? buildBody(form, today) : "";
  const mailto = mounted ? mailtoHref(form, today) : "";
  const long = mailto.length > MAILTO_SAFE_LENGTH;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `To: ${OPERATOR.email}\nSubject: ${subjectFor(form)}\n\n${body}`,
      );
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2400);
    } catch {
      setCopied(false);
    }
  };

  // A button that is still waiting stays a link (so it is one for a screen reader), and a press on
  // it goes to the first box that is empty instead of opening anything.
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (ready) return;
    event.preventDefault();
    const empty = name.trim() === "" ? "td-name" : items.trim() === "" ? "td-items" : "td-why";
    document.getElementById(empty)?.focus();
  };

  return (
    <section className={styles.composer} aria-labelledby="compose-title">
      <h2 id="compose-title" className={styles.heading}>
        Write the message
      </h2>
      <p className={styles.help}>
        Fill in the three boxes. Then open the message in your email app, or copy it. Nothing is
        sent from this page, and what you type does not leave your browser until you send it
        yourself.
      </p>

      <div className={styles.field}>
        <label htmlFor="td-name">Your name</label>
        <input
          id="td-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
      </div>

      <fieldset className={styles.roles}>
        <legend>You are</legend>
        {ROLES.map((r) => (
          <label key={r.id} className={styles.role}>
            <input
              type="radio"
              name="td-role"
              value={r.id}
              checked={role === r.id}
              onChange={() => {
                setRole(r.id);
              }}
            />
            <span>{r.label}</span>
          </label>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="td-items">What to take down</label>
        <textarea
          id="td-items"
          rows={3}
          value={items}
          onChange={(e) => {
            touched.current = true;
            setItems(e.target.value);
          }}
        />
        <p className={styles.note}>
          Its title and the address of the page. One item to a line. The &quot;Copyright or
          takedown&quot; link on a picture fills this in for you.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="td-why">Why</label>
        <textarea
          id="td-why"
          rows={4}
          value={statement}
          onChange={(e) => {
            setStatement(e.target.value);
          }}
        />
        <p className={styles.note}>{HINTS[role]}</p>
      </div>

      <div className={styles.send} aria-live="polite">
        {mounted ? (
          <>
            <div className={styles.buttons}>
              <a
                className={styles.button}
                href={ready ? mailto : "#td-name"}
                aria-disabled={!ready}
                data-ready={ready}
                onClick={open}
              >
                Open in my email app
              </a>
              <a
                className={styles.button}
                href={ready ? gmailHref(form, today) : "#td-name"}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!ready}
                data-ready={ready}
                onClick={open}
              >
                Gmail
              </a>
              <a
                className={styles.button}
                href={ready ? outlookHref(form, today) : "#td-name"}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!ready}
                data-ready={ready}
                onClick={open}
              >
                Outlook
              </a>
              <button
                type="button"
                className={styles.button}
                aria-disabled={!ready}
                data-ready={ready}
                onClick={() => {
                  if (ready) void copy();
                }}
              >
                {copied ? "Copied" : "Copy message"}
              </button>
            </div>
            {!ready ? <p className={styles.note}>Still needed: {missing.join(", ")}.</p> : null}
            {ready && long ? (
              <p className={styles.note}>
                The message is long, and some email apps cut a long one. Use Copy message and paste
                it into your email instead.
              </p>
            ) : null}
          </>
        ) : null}
        <p className={styles.note}>
          Or write to <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> yourself. We reply
          to the address you send from.
        </p>
      </div>

      {mounted && ready ? (
        <div className={styles.field}>
          <label htmlFor="td-preview">The message</label>
          <textarea id="td-preview" rows={12} readOnly value={body} />
        </div>
      ) : null}
    </section>
  );
}
