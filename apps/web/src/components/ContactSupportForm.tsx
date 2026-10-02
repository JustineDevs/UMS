"use client";

import { useCallback, useReducer, useRef } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Textarea,
} from "@universal-music-store/ui";
import { RecaptchaScript } from "@/components/RecaptchaScript";
import { getRecaptchaToken } from "@/lib/recaptcha-client";

type SubmitStatus = "idle" | "sending" | "sent" | "error";
type FormState = {
  name: string;
  senderEmail: string;
  orderNumber: string;
  subject: string;
  body: string;
  submitStatus: SubmitStatus;
  errorMsg: string | null;
};
type FormAction =
  | { type: "field"; field: "name" | "senderEmail" | "orderNumber" | "subject" | "body"; value: string }
  | { type: "sending" }
  | { type: "sent" }
  | { type: "error"; message: string }
  | { type: "validation-error"; message: string };

const initialFormState: FormState = {
  name: "",
  senderEmail: "",
  orderNumber: "",
  subject: "",
  body: "",
  submitStatus: "idle",
  errorMsg: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  if (action.type === "field") return { ...state, [action.field]: action.value };
  if (action.type === "sending") return { ...state, submitStatus: "sending", errorMsg: null };
  if (action.type === "sent") return { ...initialFormState, submitStatus: "sent" };
  if (action.type === "error") return { ...state, submitStatus: "error", errorMsg: action.message };
  return { ...state, errorMsg: action.message };
}

export function ContactSupportForm({
  supportEmail,
  supportPhone,
}: {
  supportEmail?: string;
  supportPhone?: string;
}) {
  const email =
    supportEmail?.trim() && supportEmail.includes("@") ? supportEmail.trim() : undefined;
  const phone = supportPhone?.trim() || undefined;
  const [form, dispatch] = useReducer(formReducer, initialFormState);
  const { name, senderEmail, orderNumber, subject, body, submitStatus, errorMsg } = form;
  const submittingRef = useRef(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitStatus === "sending" || submittingRef.current) return;
      if (!body.trim() || !senderEmail.trim()) {
        dispatch({ type: "validation-error", message: "Please fill in your email and message." });
        return;
      }
      submittingRef.current = true;
      dispatch({ type: "sending" });
      try {
        const recaptchaToken = await getRecaptchaToken("contact");
        const res = await fetch("/api/forms/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim() || undefined,
            email: senderEmail.trim(),
            orderNumber: orderNumber.trim() || undefined,
            subject: subject.trim() || "Customer inquiry",
            message: body.trim(),
            recaptchaToken,
          }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        dispatch({ type: "sent" });
      } catch (err) {
        dispatch({ type: "error", message: err instanceof Error ? err.message : "Submission failed. Please try again." });
      } finally {
        submittingRef.current = false;
      }
    },
    [name, senderEmail, orderNumber, subject, body, submitStatus],
  );

  return (
    <div className="space-y-6 font-body text-on-surface-variant" aria-live="polite">
      <RecaptchaScript />
      {email ? (
        <p className="text-sm">
          <span className="font-medium text-primary">Email:</span>{" "}
          <a className="underline hover:text-primary" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Email not configured</AlertTitle>
          <AlertDescription className="text-sm">
            Set support email in Admin under Settings, Storefront home, Contact and social section,
            or add{" "}
            <code className="rounded bg-surface-container-high px-1">
              NEXT_PUBLIC_SUPPORT_EMAIL
            </code>{" "}
            in the storefront environment.
          </AlertDescription>
        </Alert>
      )}
      {phone ? (
        <p className="text-sm">
          <span className="font-medium text-primary">Phone:</span>{" "}
          <a
            className="underline hover:text-primary"
            href={`tel:${phone.replace(/\s/g, "")}`}
          >
            {phone}
          </a>
        </p>
      ) : null}

      {submitStatus === "sent" ? (
        <Alert>
          <AlertTitle>Message sent</AlertTitle>
          <AlertDescription className="text-sm">
            We received your message and will get back to you shortly.
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-name" variant="form">
              Name
            </Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => dispatch({ type: "field", field: "name", value: e.target.value })}
              className="max-w-md"
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-email" variant="form">
              Your email <span className="text-error">*</span>
            </Label>
            <Input
              id="contact-email"
              type="email"
              required
              value={senderEmail}
              onChange={(e) => dispatch({ type: "field", field: "senderEmail", value: e.target.value })}
              className="max-w-md"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-order-number" variant="form">
              Order number <span className="text-on-surface-variant">(optional)</span>
            </Label>
            <Input
              id="contact-order-number"
              value={orderNumber}
              onChange={(e) => dispatch({ type: "field", field: "orderNumber", value: e.target.value })}
              className="max-w-md"
              autoComplete="off"
              placeholder="example: order_1234"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-subject" variant="form">
              Subject
            </Label>
            <Input
              id="contact-subject"
              value={subject}
              onChange={(e) => dispatch({ type: "field", field: "subject", value: e.target.value })}
              className="max-w-md"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-body" variant="form">
              Message <span className="text-error">*</span>
            </Label>
            <Textarea
              id="contact-body"
              required
              value={body}
              onChange={(e) => dispatch({ type: "field", field: "body", value: e.target.value })}
              rows={6}
              className="max-w-lg"
            />
          </div>
          {errorMsg ? (
            <p className="text-xs text-error" role="alert">
              {errorMsg}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={submitStatus === "sending"}
            className="uppercase tracking-widest"
          >
            {submitStatus === "sending" ? "Sending..." : "Send message"}
          </Button>
        </form>
      )}
    </div>
  );
}
