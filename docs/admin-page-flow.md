# Admin Page Flow

Use the admin page to turn Cornell listserv emails into reviewed Loop events.

## Access

- Open `/admin`.
- Enter the admin token.
- Check the Gmail status dot in the top bar.
- Use `Sign out` when finished.

### Admin Token

The admin page uses one shared secret token.

- The backend reads it from the Convex env var `ADMIN_TOKEN`.
- Every admin action sends the token to Convex for verification.
- The browser stores the entered token in `sessionStorage`, so it lasts only for the current browser session.
- The token is never put in the Gmail OAuth URL; the app creates a short-lived nonce instead.

Set or update the token in the Convex dashboard for the target deployment:

1. Open the Convex dashboard.
2. Select the Loop project and deployment.
3. Go to environment variables.
4. Set `ADMIN_TOKEN` to a long random value.
5. Share it only with trusted admins.

For local development, set the same env var in the local Convex environment before using `/admin`.

## Recommended Workflow

1. `Setup`: connect Gmail and find candidate sources.
2. `Sources`: approve sources and assign them to organizations.
3. `Join`: subscribe the inbox to each source — a web form for Cornell e-lists,
   an email request for everything else.
4. `Ingest`: pull email and clear subscription confirmations.
5. `Publish`: parse messages, review drafts, and publish events.

## Setup

Use this tab to prepare the email pipeline.

- `Connect Gmail`: connects `dtiincubator@gmail.com` for reading incoming mail and sending join emails.
- `Reconnect`: use if Gmail shows an error or permissions changed.
- `Run discovery`: searches the sender dataset for likely Cornell listserv addresses.
- `Add candidate manually`: use when you already know an address to track.

After discovery or manual add, go to `Sources` to review candidates.

## Sources

Use this tab to decide which senders belong to which organizations.

### Candidates

Candidates are possible listserv addresses found by discovery or added manually.

- `Approve`: creates a source from the candidate.
- `Rename`: changes the display name before approval.
- `Reject`: dismisses a source we do not want.

### Sources Needing An Organization

These cannot be parsed until assigned.

- `Create org`: create a new organization and assign the source to it.
- `Assign existing`: connect the source to an organization already in Loop.
- `Ignore`: hide sources that are spam, admin-only, irrelevant, or not useful.

Prefer `Assign existing` when the organization already exists. This avoids duplicates.

### Assigned Sources

Assigned sources are ready for parsing once messages arrive.

- `Reassign`: move the source to a different organization.
- `Ignore`: pause the source if it should no longer be tracked.

### Ignored Sources

Ignored sources are paused but not deleted.

- `Reactivate`: bring a source back into the workflow.
- `Assign org`: reactivate and assign it to an organization.

### Organizations

Use this section to create or edit org records.

Important fields:

- `Name`: public organization name.
- `Type`: club, department, official, publication, company, or other.
- `Status`: `active` shows the org; `hidden` hides it.
- `Description`, `Tags`, `Website URL`, `Contact email`: public profile details.
- `Avatar`, `Cover image`: public org images.
- `Loop summary`: short profile summary.
- `Verified organization`: marks trusted orgs.

## Join

Use this tab to subscribe `dtiincubator@gmail.com` to each source. Which
controls a row shows depends on its join method.

### Cornell e-lists (`cornell simplelists`)

Every current Cornell e-list lives on `lists.cornell.edu`, which is
web-interface only — these lists cannot be joined by email at all, so the row
shows no email composer.

1. `Submit subscribe form`: posts the list's public subscribe form for you.
2. The row records the attempt and moves to `awaiting confirmation`.
3. Simplelists replies with a confirmation email. Handle it in `Ingest` →
   `Confirmation queue`.

The subscribe URL is always shown as a link above the button. If the submit
fails — or the list requires manager approval — open that link and subscribe by
hand; the reason is printed on the row.

A closed or approval-only list should be switched to
`cornell simplelists owner contact` in `Settings`, which emails the list's human
manager at `<list>-manager@lists.cornell.edu` instead.

### Everything else

- `Prepare email`: creates a draft join email.
- Review `To`, `Subject`, and `Body` before sending.
- `Send`: sends from `dtiincubator@gmail.com`.

### Settings

- `Join method`: change only if the detected one looks wrong. The two
  `cornell lyris` values are retired and no longer offered for new selections;
  a row already carrying one still displays it.
- `Source status`: `joining` / `active` / `paused` / `failed`.
- `Re-detect`: re-runs detection over the row's addresses. Nothing reclassifies
  on its own, so use this after fixing an address.

`Recent join attempts` shows both web-form and email attempts, with the HTTP
status or error for each. Joined sources move into `Joined sources`.

## Ingest

Use this tab to pull mail from Gmail and handle confirmations.

- Ingestion runs automatically every 10 minutes.
- `Run now`: manually polls Gmail.
- `Recent messages`: shows incoming messages and whether they matched a source.

### Confirmation Queue

Every Simplelists subscribe requires a confirmation click, and some other
listservs do too.

1. Open the confirmation link.
2. Complete the confirmation page.
3. Return to admin.
4. Click `Clear`.

A confirmation link is only clickable when the mail server authenticated the
sender for a Cornell domain. An unauthenticated one is shown as plain text —
inspect it in Gmail before acting on it.

Clearing a confirmation marks the matched source as joined and active.

## Publish

Use this tab to turn assigned emails into public events.

- `ready`: messages that can be parsed.
- `needs assignment`: messages blocked until their senders are assigned in `Sources`.
- `drafts`: parsed items waiting for review.
- `Run parser`: extracts draft events from ready messages.

Review every draft before publishing.

- `Publish`: makes the item visible in the user-facing feed.
- `Hide`: removes a bad or irrelevant draft.
- `Reparse`: reruns AI parsing for the source message.
- `More`: shows full details and links.

Check title, date, location, description, and links before publishing.

## Common Terms

- `Candidate`: possible source that has not been approved yet.
- `Source`: email sender or listserv we may ingest from.
- `Organization`: club, department, company, or group shown in Loop.
- `Assigned`: source is connected to an organization.
- `Ignored` / `Paused`: source is hidden from the active workflow.
- `Joined`: `dtiincubator@gmail.com` is subscribed or receiving useful mail.
- `Draft`: parsed item waiting for admin review.
- `Published`: visible to users.
- `Hidden`: rejected draft.
- `Failed`: action or parser run errored and may need retry.

## Troubleshooting

- Gmail says not connected: go to `Setup` and reconnect Gmail.
- Parser button is disabled: no assigned ready messages exist yet.
- Messages need assignment: go to `Sources` and assign the sender.
- Confirmation link is missing: inspect the email manually in Gmail, then clear only after confirming.
- Join email failed: check Gmail connection, then retry from `Join`.
- Subscribe form failed with 404: the list does not exist or does not allow
  self-subscribe. Switch the row to `cornell simplelists owner contact` and
  email the list manager instead.
- Subscribe form failed for another reason: open the subscribe link on the row
  and complete the form by hand.
- Parser failed: use `Retry` on the failed message or rerun the parser later.

## Safe Operating Rules

- Do not publish without checking the event details.
- Do not send join emails without reviewing the recipient and subject.
- Do not email a `lists.cornell.edu` address asking to be added — Simplelists
  ignores email commands. Use the subscribe form.
- Do not create a new organization if the org already exists.
- Ignore obvious spam, unsubscribe, bounce, and admin-only senders.
- When unsure, leave the item unmodified and ask another team member.
