# School Fee Hub

Multi-portal school management app built with Vite, React, TypeScript, Tailwind, and Supabase.

## Portals

- `admin` portal
- `staff` portal
- `fee` portal

The current source tree does not include a separate `student` portal. If you need one, that is a new feature rather than a deployment toggle.

## Local Development

```sh
npm install
npm run dev
```

## Deployment

Build each portal separately and deploy the matching output folder:

```sh
npm run build:admin
npm run build:staff
npm run build:fee
```

Or build all three in one pass:

```sh
npm run build:all
```

Deployment targets:

- Admin portal: `dist-admin/`
- Staff portal: `dist-staff/`
- Fee portal: `dist-fee/`

The shared combined build is still available with `npm run build`, which writes to `dist/`.

## Runtime Configuration

Portal builds inject runtime environment values through `scripts/build-portal.mjs` from `.env` files in the app root. Keep deployment-specific values in environment files or host-level environment variables, not in committed build artifacts.

## Notes

- Generated portal bundles are ignored in `.gitignore`.
- The canonical deployable app lives in this `school-fee-hub-main` tree.
