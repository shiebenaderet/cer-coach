# CER Coach

A step-by-step coach that helps 8th graders build a Claim, Evidence and Reasoning (CER) response to any question, with a matching paper set and a teacher dashboard for building CERs. Supports fade as students show they can do each part alone.

Live site: **https://cer.mrbsocialstudies.org** (Cloudflare Pages, deployed from `main`).

## Students

- No sign-in. Students open the link their teacher shares (`/?q=<id>`).
- **Eight stations:** Set Up, Unpack, Gather, First Claim, Choose, Reasoning, Stress Test, Check.
- **Push-back:** rules in the browser ask one follow-up question when an answer is vague, unsourced, or only repeats the evidence.
- **Support levels per move (Claim, Evidence, Reasoning):** Model » Guided » Prompted » Solo.
- **Versions:** Quick, Clear, Full, Deep, matching the paper set. Full and Deep require a counterpoint.
- Work saves in the student's browser only. The finished CER is written on paper.

## Teachers (`/teach/`)

- Sign in with Google using an **@edmonds.wednet.edu** account, or with an emailed six-digit code if that is turned on.
- Teachers listed in `ADMIN_EMAILS` are approved admins. Anyone else in the district domain can sign in and request access; an admin approves or declines them on the Teachers tab.
- **Build a CER:** question, title, unit, default version, word bank, and up to 12 sources: excerpts with citations, PDFs, images, document files, or links. Saving gives a student link to post in Canvas.

## How It's Built

```
site/                  static files (the Pages output folder)
  index.html           student app
  teach/index.html     teacher dashboard
  assets/js/           app.js, rules.js, content.js, store.js (students); teach.js (teachers)
  prompts/             built-in practice CERs as JSON
functions/             Cloudflare Pages Functions (the API)
  api/auth/            google.js, code/request.js, code/verify.js, logout.js, dev.js (local only)
  api/access/          request.js (ask for access)
  api/admin/           teachers.js (list, approve, decline)
  api/teacher/         prompts (create, edit, delete), upload.js
  api/prompts/[id].js  public: students load a teacher-built CER
  files/[[path]].js    public: uploaded source files
lib/server.js          sessions, Google token check, validation
schema.sql             database tables (Cloudflare D1)
wrangler.toml          bindings and settings
print/                 paper-set build script and print-ready PDFs
tests/                 node tests (run: node tests/google-token.test.mjs)
docs/plan.md           plan, research base and fade rules
```

**Cloudflare resources:** D1 database `cer-coach` (binding `DB`), R2 bucket `cer-coach-files` (binding `FILES`).

**Settings** (`wrangler.toml` `[vars]`): `ALLOWED_DOMAIN`, `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, `MAIL_FROM`.
**Secrets** (set in the Cloudflare dashboard, never in the repo): `SESSION_SECRET` (required), `RESEND_API_KEY` (only for emailed codes).

## Working on It Locally

```
npm install -g wrangler
wrangler d1 execute cer-coach --local --file schema.sql
printf 'SESSION_SECRET=any-long-string\nDEV_LOGIN=1\n' > .dev.vars
wrangler pages dev
```

With `DEV_LOGIN=1`, `POST /api/auth/dev {"email": "..."}` signs in without Google, but only on localhost. Never set `DEV_LOGIN` in Cloudflare.

Work on a branch (Cloudflare gives each branch a preview link), then merge to `main` to publish.

## Adding a Built-In Practice CER

Copy `site/prompts/_template.json` to `site/prompts/<id>.json`, put files in `site/sources/<id>/`, and list it in `site/prompts/index.json`. Most CERs should be built in the dashboard instead.

## Paper Set

`print/pdf/` holds the print masters. To rebuild: `cd print && npm install && python3 build.py` (needs Python Playwright).
