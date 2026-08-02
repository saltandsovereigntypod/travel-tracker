# Wayfarer Workspace

A polished starter for a visual life workspace where travel planning is the first application, not the architectural limit.

## What is included

- Marketing landing page
- Personal dashboard with project cards and upcoming events
- Full trip overview with lifecycle, records, budget, readiness, and collaborators
- Fabric.js visual editor with text, shapes, checklists, data cards, images, layering, alignment, duplication, locking, deletion, undo/redo, zoom, and local saving
- Templates and reusable asset library pages
- Responsive phone, tablet, and desktop layouts
- Local placeholder data and localStorage persistence
- Supabase-ready domain boundaries
- Basic Node structure tests

## Run locally

Because the app uses ES modules, serve it over HTTP rather than opening the files directly.

```bash
npx serve .
```

Then open the URL printed by `serve`.

## Tests

```bash
npm test
```

No install is required for the current tests because they use Node's built-in test runner.

## GitHub Pages

This is a static site. In repository Settings, open Pages, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.

## Architecture

The local starter state is organized as:

```text
Users
  -> Workspaces
    -> Projects
      -> Records
      -> Views
        -> Canvas Designs
    -> Templates
    -> Assets
```

Records are canonical data. Templates and canvas scenes define appearance. Personal canvas designs include an `ownerId`, so collaborators can share records while maintaining different visual views.

See `docs/ARCHITECTURE.md` for the recommended Supabase migration boundaries.

## Important editor note

Fabric.js is loaded from jsDelivr on `editor.html`. For a production build, pin and self-host the library or add a bundler. The editor displays a clear connection error if the CDN is unavailable.

## Next development phases

1. Add repository adapters and Supabase authentication.
2. Add row-level security for workspace membership and record visibility.
3. Bind canvas objects to live project records.
4. Add project and record creation forms.
5. Add cloud asset uploads and collaborative presence.
6. Add map and calendar adapters behind reusable view interfaces.
