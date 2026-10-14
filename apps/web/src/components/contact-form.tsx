"use client";

import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@aspirant/ui/components/button";
import { Input } from "@aspirant/ui/components/input";
import { Label } from "@aspirant/ui/components/label";
import { Textarea } from "@aspirant/ui/components/textarea";

export const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Enter a valid email address"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactValues = z.infer<typeof contactSchema>;

function FieldErrors({ errors }: { errors: readonly unknown[] }) {
  const messages = errors
    .map((e) => (typeof e === "object" && e && "message" in e ? String(e.message) : null))
    .filter((m): m is string => !!m);
  if (messages.length === 0) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {messages[0]}
    </p>
  );
}

/** TanStack Form + Zod (Standard Schema). Static site: submit is simulated client-side. */
export function ContactForm() {
  const form = useForm({
    defaultValues: { name: "", email: "", message: "" } satisfies ContactValues,
    validators: { onChange: contactSchema },
    onSubmit: async ({ value, formApi }) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      toast.success(`Thanks ${value.name}! (demo only: nothing was sent)`);
      formApi.reset();
    },
  });

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            {field.state.meta.isTouched && <FieldErrors errors={field.state.meta.errors} />}
          </div>
        )}
      </form.Field>
      <form.Field name="email">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              id={field.name}
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            {field.state.meta.isTouched && <FieldErrors errors={field.state.meta.errors} />}
          </div>
        )}
      </form.Field>
      <form.Field name="message">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Message</Label>
            <Textarea
              id={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
            />
            {field.state.meta.isTouched && <FieldErrors errors={field.state.meta.errors} />}
          </div>
        )}
      </form.Field>
      <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
        {({ canSubmit, isSubmitting }) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Sending…" : "Send message"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
