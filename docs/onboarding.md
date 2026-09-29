# Onboarding Instructions:

Make sure git and bun are installed in your system. For installing bun, reference: https://bun.com/docs/installation for more information.

1. Clone the repository via HTTPS or SSH

```bash
cd Desktop
git clone <repo url or ssh command>
cd cornell-loop
code .
```

2. Install dependencies at the root of the repo

```bash
bun install
```

3. Add environment files

Environment files .env.local should be added at the root and apps/extension. The same goes for an .env.production file with the same variables, but production values.

Env files are also **gitignored** and should be added to your .gitignore file.

Variables needed:
`CONVEX_DEPLOYMENT` `VITE_CONVEX_URL` `VITE_CONVEX_SITE_URL` `VITE_DASHBOARD_URL`

4. Running the Dashboard

At the repo root:

```bash
bun run dev:convex
```

Open another terminal:

```bash
bun run dev
```

5. Running the Extension

Similarly, at the repo root:

```bash
bun run dev:convex
```

```bash
bun run build:extension
```

In a chrome tab, go to chrome://extensions, on the top right corner toggle Developer Mode **on**, click Load Unpacked on the top left, and choose apps/extension/dist folder in your local version of the repository.

Open Gmail or Google Calendar to see the extension.

6. Ensure Convex backend secrets are set up in your dev deployment

- Convex Dashboard -> Settings -> Environment Variables
- TPM will provide the necessary variables and permissions.
