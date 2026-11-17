// Creating a space: from a built-in starter or from a saved/shared template.
import { friendlyError, supabase } from "./supabase";
import { searchPlaces } from "./services";
import { SPACE_LISTS, buildLists } from "./list-templates";
import { instantiate, type TemplateData } from "./space-templates";

export interface NewSpaceForm {
  name: string;
  kind: string;
  icon: string;
  destination: string;
  start: string | null;
  end: string | null;
  currency: string;
}

export interface FromTemplate {
  id: string;
  data: TemplateData;
}

/** Returns the new space's id, plus a warning if the space was made but something inside it failed. */
export async function createSpace(form: NewSpaceForm, userId: string, template?: FromTemplate): Promise<{ id?: string; error?: string; warning?: string }> {
  const sb = supabase();
  const { data: id, error } = await sb.rpc("create_space", {
    p_name: form.name.trim(),
    p_kind: form.kind,
    p_icon: form.icon,
    p_modules: template?.data.modules ?? [],
    p_destination: form.destination.trim(),
    p_start: form.start || null,
    p_end: form.end || null,
    p_currency: form.currency,
  });
  if (error || !id) return { error: friendlyError(error) };
  const spaceId = id as string;
  let warning: string | undefined;
  const fail = (what: string, err: unknown) => {
    warning ??= `Created, but ${what} didn't copy over: ${friendlyError(err)}`;
  };

  if (template) {
    const inst = instantiate(template.data, spaceId);
    if (inst.lists.length) {
      const r = await sb.from("lists").insert(inst.lists);
      if (r.error) fail("the lists", r.error);
    }
    for (let i = 0; i < inst.items.length && !warning; i += 400) {
      const r = await sb.from("list_items").insert(inst.items.slice(i, i + 400));
      if (r.error) fail("some list items", r.error);
    }
    for (const level of inst.pageLevels) {
      if (warning) break;
      const r = await sb.from("pages").insert(level);
      if (r.error) fail("the pages", r.error);
    }
    const d = template.data.design;
    if (d) {
      const r = await sb.from("trip_views").upsert(
        { trip_id: spaceId, user_id: userId, mode: d.mode ?? "page", theme: d.theme ?? {}, page_layout: d.page_layout ?? [], board_layout: d.board_layout ?? [] },
        { onConflict: "trip_id,user_id" },
      );
      if (r.error) fail("the design", r.error);
    }
    void sb.rpc("note_template_use", { p_id: template.id });
  } else {
    const starter = SPACE_LISTS[form.kind] ?? [];
    if (starter.length) {
      const r = await sb.from("lists").insert(buildLists(starter, spaceId));
      if (r.error) fail("the starter lists", r.error);
    }
  }

  if (form.destination.trim()) {
    searchPlaces(form.destination)
      .then((r) => r[0] && sb.from("trips").update({ lat: r[0].lat, lng: r[0].lng }).eq("id", spaceId))
      .catch(() => {});
  }
  return { id: spaceId, warning };
}
