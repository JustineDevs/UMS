"use client";

import { useState } from "react";
import { Button } from "./button";
import { FcGoogle } from "react-icons/fc";

interface LoginFormProps {
  brandName?: string;
  heading?: string;
  subheading?: string;
  googleLabel?: string;
  footerPrompt?: string;
  footerActionLabel?: string;
  onFooterAction?: () => void;
  socialOnly?: boolean;
  showFooter?: boolean;
  termsHref?: string;
  privacyHref?: string;
  brandTagline?: string;
  onGoogleLogin?: (remember: boolean) => void;
  onLogin?: (email: string, password: string, remember: boolean) => void;
  onForgotPassword?: () => void;
  onCreateAccount?: () => void;
  copyrightYear?: number;
  footerLinks?: { label: string; href: string }[];
}

export default function LoginPage({
  brandName = "Universal Music Store",
  heading = "Welcome back",
  subheading = "Sign in to pick up right where you left off.",
  googleLabel = "Continue with Google",
  footerPrompt = "New here?",
  footerActionLabel = "Create a free account",
  onFooterAction,
  socialOnly = false,
  showFooter = true,
  termsHref = "/terms",
  privacyHref = "/privacy",
  onGoogleLogin,
  onLogin,
  onForgotPassword,
  onCreateAccount,
  copyrightYear = 2026,
  footerLinks = [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Support", href: "#" },
  ],
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const handleSubmit = () => {
    onLogin?.(email, password, remember);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-white dark:bg-neutral-950">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex w-full flex-1 items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-1">
              <h1 id="sign-in-heading" className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
                {heading}
              </h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {subheading}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2 border border-neutral-300 bg-neutral-50 font-medium dark:border-neutral-700 dark:bg-neutral-900"
              onClick={() => onGoogleLogin?.(remember)}
            >
              <FcGoogle className="text-base" />
              {googleLabel}
            </Button>

            {!socialOnly ? <>
              <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="text-muted-foreground text-sm font-medium tracking-widest">or</span><div className="h-px flex-1 bg-border" /></div>
              <div className="space-y-1"><label htmlFor="email" className="text-sm font-medium">Work Email</label><input id="email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-muted h-10 w-full rounded-md border px-3 text-sm" /></div>
              <div className="space-y-1"><div className="flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Password</label><button type="button" onClick={onForgotPassword} className="text-xs underline-offset-4 hover:underline">Forgot password?</button></div><input id="password" type="password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-muted h-10 w-full rounded-md border px-3 text-sm" /></div>
            </> : null}

            <div className="flex items-center gap-3">
              <input id="remember" type="checkbox" checked={remember} onChange={(event) => setRemember(event.currentTarget.checked)} className="h-4 w-4 rounded border" />
              <label htmlFor="remember" className="text-muted-foreground cursor-pointer text-sm select-none">
                Keep me signed in for 30 days
              </label>
            </div>

            {!socialOnly ? <Button
              className="h-11 w-full text-base font-semibold"
              onClick={handleSubmit}
            >
              Sign In
            </Button> : null}

            <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
              {footerPrompt}{" "}
              <button
                type="button"
                onClick={onFooterAction ?? onCreateAccount}
                className="font-medium text-neutral-950 underline-offset-4 transition-all hover:underline dark:text-neutral-50"
              >
                {footerActionLabel}
              </button>
            </p>

            <p className="text-center text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              By continuing, you agree to our{" "}
              <a href={termsHref} className="underline underline-offset-2">Terms</a>{" "}
              and{" "}
              <a href={privacyHref} className="underline underline-offset-2">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>

      {showFooter ? <footer className="flex flex-col items-center justify-between gap-2 border-t border-neutral-200 px-6 py-4 text-xs text-neutral-600 sm:flex-row dark:border-neutral-800 dark:text-neutral-400">
        <span>
          © {copyrightYear} {brandName}. All rights reserved.
        </span>
        <div className="flex items-center gap-4">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-oklch(0.145 0 0) transition-colors dark:hover:text-oklch(0.985 0 0)"
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer> : null}
    </div>
  );
}
