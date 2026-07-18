# HackNIAT — AI Hackathon Evaluator (Frontend)

A React + Vite single-page application for the **AI Hackathon Evaluator** backend.
Students upload demo videos and get instant, AI-generated feedback; evaluators
review submissions; and admins manage users and evaluator approvals.

## Tech stack

- **React 19** + **Vite 8** (with the React Compiler)
- **react-router-dom** for routing and role-based route guards
- Cookie-based auth (the backend sets an **HttpOnly** session cookie)
- Plain CSS design system (no UI framework) — see `src/index.css`

## Getting started

```bash
npm install
npm run dev      # start the dev server on http://localhost:5173
npm run build    # production build
npm run preview  # preview the production build
npm run lint     # run ESLint
```

The backend is expected to run on **http://localhost:8000**.

### API connection & auth cookies

Auth uses an HttpOnly cookie, so requests must be **same-origin** for the cookie
to be stored and sent. In development, the Vite dev server proxies the backend
route prefixes (`/auth`, `/admin`, `/submissions`, `/health`) to the API.
Configure via `.env`:

```env
VITE_API_BASE_URL=          # leave empty in dev to use the proxy (same-origin)
VITE_API_TARGET=http://localhost:8000   # where the dev proxy forwards requests
```

For production, either serve the app behind the same origin as the API, or set
`VITE_API_BASE_URL` to the API origin (the backend must then allow credentialed
CORS from the app's origin).

## Project structure

```
src/
├── api/            # API client + endpoint modules (auth, admin, evaluation)
├── components/
│   ├── ui/         # reusable primitives (Button, Input, Card, Modal, Badge…)
│   ├── layout/     # Navbar, Footer, Layout, AuthShell, PageHeader
│   ├── routing/    # ProtectedRoute, PublicOnlyRoute
│   └── evaluation/ # domain components (result view, dropzone, tables…)
├── context/        # AuthContext (session state via /auth/me)
├── hooks/          # useAuth, useAsync, usePolling
├── pages/          # route pages grouped by role (auth, student, evaluator, admin)
├── utils/          # constants, formatters, validators, local storage helpers
├── App.jsx         # router + providers
└── main.jsx        # entry point
```

## Roles & features

- **Student** — register, upload a demo video, add optional context
  (problem / solution / criteria), start AI analysis, and watch the evaluation
  poll to completion with a full score breakdown.
- **Evaluator** — register (pending admin approval), then open any evaluation
  session by its ID to review the AI results.
- **Admin** — overview dashboard, manage all users (edit name), and approve or
  review evaluator accounts.

> Student submission dashboards use `GET /submissions` as their source of truth.
> Individual submissions use `GET /submissions/{submission_id}`. Video playback
> uses its time-limited `video_url`, with authenticated
> `GET /submissions/{submission_id}/video` streaming as a fallback.
> After analysis completes, the formatted checklist and Markdown report are
> loaded from `GET /submissions/{submission_id}/report`.
> `POST /submissions` sends only the video, problem statement, and solution
> description. Team name and theme are populated by the backend from the
> authenticated student's Firestore profile.
