# Wayfarer Workspace

A visual life workspace where structured records and personal design remain separate. Travel planning is the first application, but the data model supports reusable workspaces, projects, records, templates, views, canvas designs, assets, and collaboration roles.

## Supabase setup

1. Open the Supabase project at `https://galveymskdfnxiqcloxf.supabase.co`.
2. In **SQL Editor**, create a new query.
3. Paste the complete contents of [`supabase/setup.sql`](supabase/setup.sql) and run it once.
4. In **Authentication > URL Configuration**, set the Site URL to your GitHub Pages URL and add the same URL to Redirect URLs. During local development, also add `http://localhost:8000`.
5. In **Authentication > Providers > Email**, choose whether email confirmation should be required. The UI supports either mode.
6. Deploy the repository with GitHub Pages.

The browser uses the Supabase project URL and publishable key in `assets/js/services/supabase-client.js`. A publishable key is safe to expose in browser code when Row Level Security is enabled. Never add a `service_role` key to this repository.

## What the SQL creates

- Profiles connected to Supabase Auth
- Workspaces and owner/editor/viewer membership
- Generic projects and flexible JSON-backed records
- Personal or workspace-visible views
- Owner-scoped Fabric.js canvas designs
- Reusable templates
- Private asset metadata and a private `workspace-assets` Storage bucket
- Project invitations
- Row Level Security policies for every exposed table
- A first-login seed function that creates a starter workspace and Japan 2027 project

## Local development

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. ES modules and Supabase Auth will not work correctly when opening the HTML files directly from Finder.

## Architecture

```text
Users
  -> Workspaces
    -> Workspace members
    -> Projects
      -> Records (shared information)
      -> Views (personal or shared presentation)
        -> Canvas designs (Fabric.js JSON)
    -> Templates
    -> Assets
```

The database owns information. Canvas scenes own presentation. Changing a hotel address updates the shared record. Moving that hotel card or changing its typography updates only the selected view's design.

## Current implemented cloud features

- Email/password sign-up and sign-in
- Session persistence
- Automatic starter workspace creation
- Cloud loading for workspaces, projects, records, views, designs, templates, and assets
- Fabric canvas design saving
- PNG, JPG, and WebP uploads to private Supabase Storage
- Signed asset URLs
- Sign out

Project and record creation forms, invitation acceptance, realtime collaboration, and conflict resolution are the next application layer. The schema and policies are already structured for those features.

## Tests

```bash
npm test
```

## Complete product migration

This build includes the finished CRUD and collaboration foundation for projects, trip records, lifecycle states, budgets, packing lists, notes, memories, assets, personal canvas views, settings, invitations, and Supabase persistence.

For an existing Supabase database that already ran `supabase/setup.sql`, run only:

```text
supabase/002_complete_product.sql
```

For a brand-new Supabase project, run these in order:

1. `supabase/setup.sql`
2. `supabase/002_complete_product.sql`

Deploy every file in this repository to the root of the GitHub repository. Do not place the extracted outer folder inside the repository. `index.html`, `dashboard.html`, `trip.html`, and the `assets` directory must sit at repository root.
