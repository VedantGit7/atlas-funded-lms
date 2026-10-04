"use client";

import { useState } from "react";
import { ClientApiError, clientApi } from "../../lib/client-api";
import { useAccountTheme } from "../account-settings/account-theme-context";
import { SecuritySection } from "./security-section";

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Something went wrong. Please try again.";
}

export function ChangePasswordForm() {
  const { classes } = useAccountTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.post(
        "/api/v1/me/security/password",
        { currentPassword, newPassword },
        "change-password",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SecuritySection
      title="Change password"
      description="Ensure your account is using a long, random password to stay secure."
    >
      <form
        className={`${classes.card} space-y-4`}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={classes.label} htmlFor="current-password">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              className={classes.field}
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
              }}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={classes.label} htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                className={classes.field}
                placeholder="At least 10 characters"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                }}
                required
                minLength={10}
              />
            </div>
            <div className="space-y-2">
              <label className={classes.label} htmlFor="confirm-password">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                className={classes.field}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                }}
                required
                minLength={10}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-4">
          <button type="submit" className={classes.primaryButton} disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
        {message ? <p className={classes.helper}>{message}</p> : null}
      </form>
    </SecuritySection>
  );
}

export function ChangeEmailForm() {
  const { classes } = useAccountTheme();
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth/confirm` : undefined;
      await clientApi.post(
        "/api/v1/me/security/email",
        {
          newEmail,
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
        },
        "change-email",
        { silent: true },
      );
      setMessage("Confirmation sent to your new email address.");
      setNewEmail("");
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SecuritySection
      title="Change email"
      description="We'll send a confirmation link to your new address before it takes effect."
    >
      <form
        className={`${classes.card} space-y-4`}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <label className={classes.label} htmlFor="new-email">
            New email
          </label>
          <input
            id="new-email"
            type="email"
            className={classes.field}
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
            }}
            required
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className={classes.primaryButton} disabled={busy}>
            {busy ? "Sending…" : "Change email"}
          </button>
        </div>
        {message ? <p className={classes.helper}>{message}</p> : null}
      </form>
    </SecuritySection>
  );
}

export function PhoneForm() {
  const { classes } = useAccountTheme();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startChange() {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.post("/api/v1/me/security/phone", { phone }, "change-phone-start");
      setStep("verify");
      setMessage("Enter the verification code sent to your phone.");
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function verifyChange() {
    setBusy(true);
    setMessage(null);
    try {
      await clientApi.post(
        "/api/v1/me/security/phone/verify",
        { phone, token },
        "change-phone-verify",
      );
      setStep("start");
      setToken("");
      setMessage("Phone number updated.");
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SecuritySection
      title="Phone number"
      description="Add or update the phone number used for account recovery."
    >
      <form
        className={`${classes.card} space-y-4`}
        onSubmit={(event) => {
          event.preventDefault();
          void (step === "start" ? startChange() : verifyChange());
        }}
      >
        <div className="space-y-2">
          <label className={classes.label} htmlFor="phone">
            Phone (E.164 format)
          </label>
          <input
            id="phone"
            type="tel"
            className={classes.field}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
            }}
            required
            disabled={step === "verify"}
          />
        </div>
        {step === "verify" ? (
          <div className="space-y-2">
            <label className={classes.label} htmlFor="phone-token">
              Verification code
            </label>
            <input
              id="phone-token"
              type="text"
              className={classes.field}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
              }}
              required
            />
          </div>
        ) : null}
        <div className="flex justify-end">
          <button type="submit" className={classes.primaryButton} disabled={busy}>
            {busy ? "Saving…" : step === "start" ? "Send verification code" : "Verify phone"}
          </button>
        </div>
        {message ? <p className={classes.helper}>{message}</p> : null}
      </form>
    </SecuritySection>
  );
}
