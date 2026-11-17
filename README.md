# Driftbook

Plan trips together. Design your own view.

Driftbook keeps the **information shared** and the **look personal**. Everyone on a trip sees the
same ideas, itinerary, flights, stays and budget, and anyone with edit access can change them.
Each person arranges and decorates their own view however they like (page or free-form board,
themes, fonts, colors, stickers, photos), and nobody else's view changes.

## What's inside

| Area | What it does |
|---|---|
| **My view** | Your personal home for the trip. *Page* mode (stacked blocks, like Notion) or *Board* mode (drag anything anywhere, like Milanote). Themes, fonts, colors, card styles, textures, stickers, your own images, templates. |
| **Ideas** | Everyone adds things to do. Vote, comment, filter, then **Schedule** to move them onto the itinerary. |
| **Itinerary** | Day-by-day plan with drag and drop between days. Flights and stay check-ins/outs appear on their dates automatically. |
| **Flights** | Boarding-pass cards: times, confirmation codes (tap to copy), seats, who's on each flight. |
| **Stays** | Hotels, hostels, rentals: nights, check-in times, directions, booking links, who's staying. |
| **Budget** | Expenses in any currency (auto-converted), who paid, split between whom, and **settle up** suggestions. |
| **Packing** | A shared group list (with "who's bringing it") and a private list for each person. |
| **Map** | Every plan, idea and stay with a location, with each day's route. |
| **Notes & journal** | Shared notes, private notes, and a daily trip journal. |
| **Photos** | Shared photo album with captions, favorites and comments. |
| **Scrapbook** | Turns journal entries, plans and favorite photos into a printable keepsake. |
| **People & sharing** | Invite links (edit or view-only), going/maybe status, personal colors, and a read-only public link for family. |
| **Today** | Countdown before the trip, today's plan during it. |

It works on phones (installable, with an offline copy of the last-synced trip) and updates live
when someone else makes a change, showing who's online and on which page.

## How it's built

- **Next.js 16 + TypeScript**, rendered mostly in the browser
- **Supabase** for sign-in (email/password and Google), the Postgres database, photo storage and live updates
- **Row Level Security** on every table: you only ever see trips you're a member of; viewers can't edit;
  private notes, personal packing lists and personal designs are visible only to their owner
- **Cloudflare Workers** hosting via [OpenNext](https://opennext.js.org/cloudflare)
- Free, key-less services: OpenStreetMap place search (Photon), OpenFreeMap map tiles, Frankfurter exchange rates

```
src/
  app/                 pages (routes)
  components/
    TripProvider.tsx   loads a trip, keeps it live, create/update/delete helpers
    sections/          Ideas, Itinerary, Flights, Stays, Budget, Packing, Notes, Photos, Map, ...
    view/              personal page/board canvases and the Design panel
  lib/                 types, themes, blocks, dates/money helpers, cost splitting
supabase/migrations/   database schema and access rules
tests/                 unit tests (cost splitting, dates, layouts, themes)
```

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app talks to the Supabase project configured in
`src/lib/supabase.ts` (override with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). The publishable key is safe in the browser; never put a
`service_role` key in this repo.

```bash
npm test          # unit tests
npm run lint
npm run typecheck
npm run preview   # build and run the Cloudflare Worker locally
```

## Database

The schema lives in `supabase/migrations/` and is applied in order. To set up a fresh Supabase
project, run each file in the SQL editor, oldest first.

## Deploy to Cloudflare

Easiest: in the Cloudflare dashboard, **Workers & Pages → Create → Import a repository**, pick this
repo, and use:

- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`

Or from a terminal with Wrangler logged in: `npm run deploy`.

After the first deploy, add the site's URL in Supabase under **Authentication → URL Configuration**
(Site URL and Redirect URLs) so sign-in emails and Google sign-in come back to the right place.
