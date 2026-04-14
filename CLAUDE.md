# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (Turbopack). Customer portal convention is port 3002 to avoid the admin dashboard on 3000 — set PORT in .env.local.
pnpm build            # Production build
pnpm lint             # ESLint with auto-fix
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test -- --testPathPattern="cabins"  # Run specific test file/folder
pnpm format           # Format with Prettier
pnpm ci:check         # Full CI check (format + lint + test)
```

## Architecture

### Tech Stack

- **Next.js 16** with App Router and Turbopack
- **MongoDB/Mongoose** for data persistence
- **Clerk** for authentication (user ID stored as string in `customer` field)
- **HeroUI v2** component library with Tailwind CSS
- **React Query** for server state management
- **Resend** for transactional emails
- **Stripe** for payments (`lib/stripe.ts`, webhook handler at `app/api/payments/`)

### Data Flow Pattern

```
Page/Component → Custom Hook (hooks/) → API Route (app/api/) → Mongoose Model (models/)
```

Custom hooks in `hooks/` use React Query to fetch from internal API routes. API routes connect to MongoDB via `connectDB()` from `lib/mongodb.ts`.

### Key Directories

- `app/api/` - API routes: bookings, cabins, dining, dining-reservations, experiences, experience-bookings, payments, settings, send (email)
- `models/` - Mongoose schemas: Booking, Cabin, Dining, DiningReservation, Experience, ExperienceBooking, ProcessedStripeEvent, Settings
- `hooks/` - React Query hooks matching API resources (useCabin, useBooking, etc.)
- `types/index.ts` - Centralized TypeScript types, re-exports model interfaces
- `components/ui/` - Reusable UI components
- `lib/validations/` - Zod schemas validated at API boundaries (booking, dining-reservation, experience-booking)

### Auth Routing (`proxy.ts`)

Next.js 16 replaces `middleware.ts` with `proxy.ts`. Clerk middleware lives there and gates:

- Dynamic cabin detail pages (`/cabins/[id]`) require login
- All `/api/bookings` routes require auth
- Public API routes (`/api/cabins`, `/api/experiences`, `/api/dining`, `/api/settings`) are explicitly allowed

When adding new protected routes, update `proxy.ts` — not a file named `middleware.ts`.

### Model Relationships

- **Booking.cabin** references Cabin via ObjectId
- **ExperienceBooking.experience** references Experience via ObjectId
- **DiningReservation.dining** references Dining via ObjectId
- **\*.customer** stores Clerk user ID as string (not ObjectId)
- All models extend Mongoose `Document` interface
- **ProcessedStripeEvent** stores Stripe webhook event IDs for idempotency — check this before processing a webhook to avoid double-handling

### API Response Format

All API routes return `ApiResponse<T>`:

```typescript
{ success: boolean; data?: T; error?: string; message?: string }
```

### Testing

Tests live in `__tests__/` organized by feature (bookings, cabins, lib, shared). Jest with React Testing Library. Framer-motion is mocked in `__tests__/__mocks__/`.

- HeroUI components also need manual mocks in `__tests__/__mocks__/@heroui/` — add one per package (e.g. `skeleton.js`, `tooltip.js`)
- Components that use React Query (`useX` hooks) must be mocked in page-level tests to avoid needing `QueryClientProvider`

### ESLint Rules

- JSX props must be sorted alphabetically (`react/jsx-sort-props`)
- `no-console` warns except for `warn` and `error`
- Unused vars with `_` prefix are ignored
