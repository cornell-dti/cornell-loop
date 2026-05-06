# Admin Page Flow

Use the admin page to turn Cornell listserv emails into reviewed Loop events.

## Access

- Open `/admin`.
- Enter the admin token.
- Check the Gmail status dot in the top bar.
- Use `Sign out` when finished.

## Recommended Workflow

1. `Setup`: connect Gmail and find candidate sources.
2. `Sources`: approve sources and assign them to organizations.
3. `Join`: subscribe the inbox to each source.
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

Use this tab to subscribe `dtiincubator@gmail.com` to each source.

- `Prepare email`: creates a draft join email.
- Review `To`, `Subject`, and `Body` before sending.
- `Send`: sends from `dtiincubator@gmail.com`.
- `Settings`: change join method or source status only if the default looks wrong.

For Cornell Lyris lists, the default usually sends `join` to a `-request@cornell.edu` address.

Recent join emails show whether the send succeeded. Joined sources move into `Joined sources`.

## Ingest

Use this tab to pull mail from Gmail and handle confirmations.

- Ingestion runs automatically every 10 minutes.
- `Run now`: manually polls Gmail.
- `Recent messages`: shows incoming messages and whether they matched a source.

### Confirmation Queue

Some listservs require a confirmation click.

1. Open the confirmation link.
2. Complete the confirmation page.
3. Return to admin.
4. Click `Clear`.

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
- Parser failed: use `Retry` on the failed message or rerun the parser later.

## Safe Operating Rules

- Do not publish without checking the event details.
- Do not send join emails without reviewing the recipient and subject.
- Do not create a new organization if the org already exists.
- Ignore obvious spam, unsubscribe, bounce, and admin-only senders.
- When unsure, leave the item unmodified and ask another team member.
