# task-mgmt-frontend

React 18 + Vite + TypeScript frontend for the Task & Project Management System.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm test` — run Vitest in watch mode
- `npm run test:run` — run Vitest once (CI mode)
- `npm run lint` — type-check only

## Environment variables

See `.env.example`:

- `VITE_LARAVEL_API_URL` — base URL of the Laravel API (default `http://localhost:8000`)
- `VITE_DJANGO_API_URL` — base URL of the Django overdue service (default `http://localhost:8001`)

## Stack

- React 18, React Router 6, Axios
- Vite 5, TypeScript 5
- Vitest + jsdom + Testing Library + jest-dom
- fast-check for property-based tests
- MSW for HTTP mocking in tests
