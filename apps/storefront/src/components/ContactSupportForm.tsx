"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Textarea,
} from "@universal-music-store/ui";
import { getRecaptchaToken } from "@/components/RecaptchaScript";

type SubmitStatus = "idle" | "sending" | "sent" | "error";

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
  const [name, setName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!body.trim() || !senderEmail.trim()) {
        setErrorMsg("Please fill in your email and message.");
        return;
      }
      setSubmitStatus("sending");
      setErrorMsg(null);
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
        setSubmitStatus("sent");
        setName("");
        setSenderEmail("");
        setOrderNumber("");
        setSubject("");
        setBody("");
      } catch (err) {
        setSubmitStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Submission failed. Please try again.");
      }
    },
    [name, senderEmail, orderNumber, subject, body],
  );

  return (
    <div className="space-y-6 font-body text-on-surface-variant" aria-live="polite">
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
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setSenderEmail(e.target.value)}
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
              onChange={(e) => setOrderNumber(e.target.value)}
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
              onChange={(e) => setSubject(e.target.value)}
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
              onChange={(e) => setBody(e.target.value)}
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
