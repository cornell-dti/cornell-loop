/**
 * Tells the student, inside the panel, that Loop counts what they do and lets
 * them turn it off in one click.
 *
 * The Web Store listing and the privacy policy say this too, but nobody reads
 * either; putting the control next to Sign out is what makes the disclosure
 * honest. The toggle writes `chrome.storage.local`, which the service worker
 * checks before every send, so opting out stops collection immediately rather
 * than just hiding it.
 */

import { useEffect, useState } from "react";
import { readOptOut, writeOptOut } from "../analytics";
import { openExternalUrl } from "../utils/linkUtils";

/** Blank until the policy page is published; the link is then rendered. */
const PRIVACY_POLICY_URL = (() => {
  const value = import.meta.env.VITE_PRIVACY_POLICY_URL;
  return typeof value === "string" ? value.trim() : "";
})();

const NOTE_CLASS = [
  "font-[family-name:var(--font-body)]",
  "text-[length:var(--font-size-body3)]",
  "leading-[1.5]",
  "text-[var(--color-neutral-500)]",
].join(" ");

export default function PrivacyNote() {
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    let active = true;
    void readOptOut().then((value) => {
      if (active) setOptedOut(value);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = !event.target.checked;
    setOptedOut(next);
    void writeOptOut(next);
  };

  return (
    <div className="flex w-full flex-col gap-[var(--space-1)] pt-[var(--space-1)]">
      <label className="flex cursor-pointer items-center gap-[var(--space-2)]">
        <input
          type="checkbox"
          checked={!optedOut}
          onChange={handleChange}
          className="h-[14px] w-[14px] accent-[var(--color-brand)]"
        />
        <span className={NOTE_CLASS}>Share anonymous usage data</span>
      </label>
      <p className={NOTE_CLASS}>
        Counts which features get used. Never your email, your search terms, or
        anything from your inbox.
        {PRIVACY_POLICY_URL.length > 0 && (
          <>
            {" "}
            <button
              type="button"
              className="underline"
              onClick={() => openExternalUrl(PRIVACY_POLICY_URL)}
            >
              Privacy policy
            </button>
          </>
        )}
      </p>
    </div>
  );
}
