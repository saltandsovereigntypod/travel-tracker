# Architecture Notes

## Guiding boundary

The application treats records as canonical data and canvas scenes as visual projections. A record can appear in many views without its values being duplicated into each view. Canvas objects may carry a `dataBinding.path`, but the scene stores presentation and geometry, not the authoritative record.

## Domain layers

- User: identity and personal settings
- Workspace: collaboration and membership boundary
- Project: lifecycle container, with travel as the first project type
- Record: typed information such as flight, hotel, note, task, expense, or photo
- Template: reusable visual appearance
- View: a user-owned lens over project information
- Canvas design: serialized Fabric.js scene associated with a view
- Asset: user-owned media reusable across projects

## Supabase-ready migration

The local store mirrors the eventual table boundaries. Replace `loadState`, `saveState`, and `updateState` behind a repository interface, then add Supabase implementations without changing page components or editor behavior.

Suggested tables: profiles, workspaces, workspace_members, projects, records, views, templates, canvas_designs, assets, project_invites.
