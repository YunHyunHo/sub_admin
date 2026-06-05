# AGENTS.md

## Project Workflow

This project should be handled with a token-efficient loop:

1. Analyze the current codebase before editing.
2. Summarize only the relevant findings.
3. Propose a short step plan.
4. Implement one focused step at a time.
5. Verify after each meaningful change.
6. Report concise results, not raw command dumps.

## Context Budget Rules

- Prefer `rg` and targeted file reads over broad directory scans.
- Do not paste full files unless the whole file is genuinely relevant.
- When command output is long, summarize the signal:
  - pass/fail status
  - important errors
  - changed files
  - next action
- Keep command output excerpts short. Include exact lines only when they affect the fix.
- Before a large task, build a compact map of the codebase:
  - key routes
  - key components
  - API boundaries
  - config files
  - known risks

## Request Shaping

When a feature request is vague, first convert it into a structured task brief:

```txt
Goal:
Constraints:
Known files:
Unknowns:
Planned steps:
Verification:
```

Ask for clarification only if the missing detail blocks safe progress. Otherwise make a conservative assumption and continue.

## Codebase Analysis Pattern

Use this pattern before edits:

1. Find relevant files with `rg` or `rg --files`.
2. Read only the smallest useful slices.
3. Identify existing patterns before adding new ones.
4. Name the exact files to change.
5. Keep unrelated files untouched.

Useful commands:

```bash
rg "keyword" app
rg --files app
git status -sb
git diff --stat
npm run build
```

## Implementation Pattern

- Make small, focused edits.
- Prefer existing project conventions.
- Keep UI behavior explicit and predictable.
- Avoid adding new libraries unless the task clearly needs one.
- For auth, never log passwords or tokens.
- For production secrets, use environment variables.

## Verification Pattern

Run the smallest check that proves the change:

- UI or Next.js change: `npm run build`
- Git state: `git status -sb`
- API route behavior: targeted `curl` request with fake or test data
- Browser behavior: verify the exact flow that changed

When verification output is long, summarize it like:

```txt
Build: passed
Changed routes: /, /api/auth/login
Risk: deploy requires Vercel redeploy
```

## Review Graph Habit

For larger work, keep a compact review graph instead of rereading everything:

```txt
Feature
-> files touched
-> data flow
-> risks
-> verification
```

Example:

```txt
Partner login
-> app/page.js
-> app/api/auth/login/route.js
-> loginId/password -> Next API -> central auth API -> session
-> risks: token storage, failed API response shape
-> verify: fake login returns 401, real test account logs in
```

## Reporting Style

Final reports should be short and practical:

- what changed
- what was verified
- what remains
- commit/push info when relevant

Avoid copying full logs. If the user needs details, provide only the meaningful lines.

## Current Project Notes

- Framework: Next.js App Router
- Main UI: `app/page.js`
- Styles: `app/globals.css`
- Partner auth route: `app/api/auth/login/route.js`
- Dashboard mock route: `app/api/dashboard/route.js`
- Build command: `npm run build`
- Production host: `https://laylow.org` / `https://www.laylow.org`
- Partner auth endpoint: `https://laylow.me/partner/auth/login`

## Safe Logging

Allowed in logs:

- `loginId`
- HTTP status
- API error message
- partner id/domain after successful auth

Never log:

- password
- access token
- API keys
- raw secret environment variables
