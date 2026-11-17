"use client";

import { useEffect, useState } from "react";
import { X, Upload, Loader2, Plus, Trash2, RotateCcw, Save, Globe, Lock } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../AuthProvider";
import { useTrip } from "../TripProvider";
import { useToast } from "../ui/Toast";
import { Field, Segmented } from "../ui/Fields";
import { shrinkImage } from "../sections/Photos";
import { BLOCKS, EMOJI_STICKERS, STICKERS, blockMeta, defaultPageLayout, pageToBoard } from "@/lib/blocks";
import { DEFAULT_THEME, FONTS, TEXTURES, THEME_PRESETS, fontHref } from "@/lib/themes";
import { friendlyError, supabase } from "@/lib/supabase";
import type { BlockProps, BlockStyle, BlockType, BlockWidth, CardStyle, Template, Theme, UserAsset } from "@/lib/types";

type Tab = "theme" | "add" | "block" | "templates";

export interface SelectedBlock {
  id: string;
  type: BlockType;
  width?: BlockWidth;
  props?: BlockProps;
  style?: BlockStyle;
}

const CARD_STYLES: { value: CardStyle; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "flat", label: "Flat" },
  { value: "outlined", label: "Outline" },
  { value: "paper", label: "Paper" },
  { value: "glass", label: "Glass" },
];

/** Loads every font once so the font picker can preview them. */
function useAllFonts(enabled: boolean) {
  useEffect(() => {
    if (!enabled || document.getElementById("all-fonts")) return;
    const link = document.createElement("link");
    link.id = "all-fonts";
    link.rel = "stylesheet";
    link.href = fontHref(FONTS.map((f) => f.name))!;
    document.head.appendChild(link);
  }, [enabled]);
}

export function DesignPanel({
  onClose,
  selected,
  onUpdateSelected,
  onAdd,
  onApplyTemplate,
}: {
  onClose: () => void;
  selected: SelectedBlock | null;
  onUpdateSelected: (patch: Partial<SelectedBlock>) => void;
  onAdd: (type: BlockType, props?: BlockProps) => void;
  onApplyTemplate: (t: Pick<Template, "theme" | "page_layout" | "board_layout">) => void;
}) {
  const [tab, setTab] = useState<Tab>("theme");
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  useAllFonts(true);
  // Jump to the Block tab whenever a different block gets selected.
  if ((selected?.id ?? null) !== lastSelected) {
    setLastSelected(selected?.id ?? null);
    if (selected) setTab("block");
  }

  return (
    <aside className="design-panel" aria-label="Design your view">
      <header>
        <div>
          <strong className="heading" style={{ fontSize: "1.1rem" }}>Design my view</strong>
          <div className="tiny muted">Only you see these changes.</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close design panel"><X size={18} /></button>
      </header>
      <div className="panel-tabs">
        {(["theme", "add", "block", "templates"] as Tab[]).map((t) => (
          <button key={t} className={clsx(tab === t && "on")} onClick={() => setTab(t)}>
            {t === "theme" ? "Theme" : t === "add" ? "Add" : t === "block" ? "Block" : "Templates"}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === "theme" && <ThemeTab />}
        {tab === "add" && <AddTab onAdd={onAdd} />}
        {tab === "block" && <BlockTab selected={selected} onUpdate={onUpdateSelected} />}
        {tab === "templates" && <TemplatesTab onApply={onApplyTemplate} />}
      </div>
    </aside>
  );
}

function ThemeTab() {
  const { view, saveView } = useTrip();
  const theme = view.theme as Theme;
  const set = (p: Partial<Theme>) => saveView({ theme: { ...theme, ...p } });
  const [uploading, setUploading] = useState<"bg" | "cover" | null>(null);
  const upload = useAssetUpload();

  return (
    <>
      <section>
        <h4>Start from a look</h4>
        <div className="preset-grid">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              className={clsx("preset", theme.preset === p.id && "on")}
              style={{ background: p.theme.bg, color: p.theme.ink, fontFamily: `'${p.theme.headingFont}'` }}
              onClick={() => saveView({ theme: { ...p.theme, cover: theme.cover } })}
            >
              {p.name}
              <div className="preset-swatches">
                {[p.theme.surface, p.theme.accent, p.theme.accent2, p.theme.ink].map((c) => <span key={c} style={{ background: c }} />)}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h4>Colors</h4>
        <div className="swatch-row">
          {([
            ["bg", "Background"],
            ["surface", "Cards"],
            ["ink", "Text"],
            ["muted", "Soft text"],
            ["accent", "Accent"],
            ["accent2", "Second accent"],
            ["border", "Borders"],
          ] as [keyof Theme, string][]).map(([k, label]) => (
            <label key={k}>
              <input type="color" value={String(theme[k])} onChange={(e) => set({ [k]: e.target.value, preset: "custom" } as Partial<Theme>)} />
              {label}
            </label>
          ))}
        </div>
      </section>
      <section>
        <h4>Heading font</h4>
        <FontPicker value={theme.headingFont} onChange={(f) => set({ headingFont: f, preset: "custom" })} />
      </section>
      <section>
        <h4>Body font</h4>
        <FontPicker value={theme.bodyFont} onChange={(f) => set({ bodyFont: f, preset: "custom" })} />
      </section>
      <section>
        <h4>Cards</h4>
        <Segmented<CardStyle> size="sm" value={theme.cardStyle} onChange={(v) => set({ cardStyle: v })} options={CARD_STYLES} />
        <label className="field" style={{ marginTop: "0.8rem" }}>
          <span className="field-label">Corner roundness: {theme.radius}px</span>
          <input type="range" min={0} max={32} value={theme.radius} onChange={(e) => set({ radius: Number(e.target.value) })} />
        </label>
      </section>
      <section>
        <h4>Page background</h4>
        <Segmented<Theme["background"]["kind"]>
          size="sm"
          value={theme.background.kind}
          onChange={(k) =>
            set({ background: { kind: k, value: k === "texture" ? "paper" : k === "gradient" ? `linear-gradient(160deg, ${theme.bg}, ${theme.surface})` : k === "color" ? theme.bg : theme.background.value } })
          }
          options={[{ value: "color", label: "Color" }, { value: "texture", label: "Texture" }, { value: "gradient", label: "Gradient" }, { value: "image", label: "Photo" }]}
        />
        <div style={{ marginTop: "0.6rem" }}>
          {theme.background.kind === "texture" && (
            <div className="chip-row">
              {Object.entries(TEXTURES).map(([id, t]) => (
                <button key={id} className={clsx("chip chip-toggle", theme.background.value === id && "chip-on")} style={{ paddingLeft: "0.7rem" }} onClick={() => set({ background: { kind: "texture", value: id } })}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {theme.background.kind === "gradient" && (
            <GradientPicker value={theme.background.value} onChange={(v) => set({ background: { kind: "gradient", value: v } })} />
          )}
          {theme.background.kind === "image" && (
            <label className="btn btn-sm">
              {uploading === "bg" ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Upload a background photo
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading("bg");
                const url = await upload(f);
                setUploading(null);
                if (url) set({ background: { kind: "image", value: url } });
              }} />
            </label>
          )}
        </div>
      </section>
      <section>
        <h4>My cover photo</h4>
        <p className="tiny muted" style={{ marginBottom: 6 }}>Shows in your trip header. Doesn&apos;t change anyone else&apos;s.</p>
        <div className="row">
          <label className="btn btn-sm">
            {uploading === "cover" ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Upload
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading("cover");
              const url = await upload(f);
              setUploading(null);
              if (url) set({ cover: url });
            }} />
          </label>
          {theme.cover && <button className="btn btn-sm btn-ghost" onClick={() => set({ cover: undefined })}>Remove</button>}
        </div>
      </section>
      <button className="btn btn-sm btn-ghost" onClick={() => saveView({ theme: DEFAULT_THEME })}><RotateCcw size={14} /> Reset theme</button>
    </>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (f: string) => void }) {
  return (
    <div className="font-grid">
      {FONTS.map((f) => (
        <button key={f.name} className={clsx(value === f.name && "on")} style={{ fontFamily: f.css }} onClick={() => onChange(f.name)}>
          {f.name}
        </button>
      ))}
    </div>
  );
}

function GradientPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colors = value.match(/#[0-9a-fA-F]{6}/g) ?? ["#FFD6BA", "#FFF4EA"];
  const [a, b] = [colors[0], colors[1] ?? colors[0]];
  return (
    <div className="swatch-row">
      <label><input type="color" value={a} onChange={(e) => onChange(`linear-gradient(160deg, ${e.target.value} 0%, ${b} 100%)`)} /> From</label>
      <label><input type="color" value={b} onChange={(e) => onChange(`linear-gradient(160deg, ${a} 0%, ${e.target.value} 100%)`)} /> To</label>
    </div>
  );
}

/** Upload to the person's private asset bucket; returns a long-lived link. */
function useAssetUpload() {
  const { user } = useAuth();
  const toast = useToast();
  return async (file: File): Promise<string | null> => {
    if (!user) return null;
    try {
      const { blob, ext } = await shrinkImage(file, 2400);
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const sb = supabase();
      const up = await sb.storage.from("user-assets").upload(path, blob, { contentType: blob.type || file.type });
      if (up.error) throw up.error;
      await sb.from("user_assets").insert({ storage_path: path, name: file.name, user_id: user.id });
      const { data } = await sb.storage.from("user-assets").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      return data?.signedUrl ?? null;
    } catch (err) {
      toast.error(friendlyError(err));
      return null;
    }
  };
}

const BLOCK_MODULE: Partial<Record<BlockType, string>> = {
  today: "today", ideas: "ideas", itinerary: "itinerary", flights: "flights", stays: "stays",
  budget: "budget", packing: "packing", notes: "notes", photos: "photos", map: "map",
};

function AddTab({ onAdd }: { onAdd: (type: BlockType, props?: BlockProps) => void }) {
  const upload = useAssetUpload();
  const { hasModule, moduleName } = useTrip();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState<{ id: string; url: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sb = supabase();
      const { data } = await sb.from("user_assets").select("*").order("created_at", { ascending: false }).limit(24);
      const rows = (data as UserAsset[]) ?? [];
      if (!rows.length) return;
      const { data: urls } = await sb.storage.from("user-assets").createSignedUrls(rows.map((r) => r.storage_path), 60 * 60 * 24 * 365 * 5);
      setMine((urls ?? []).map((u, i) => ({ id: rows[i].id, url: u.signedUrl ?? "" })).filter((x) => x.url));
    })();
  }, [user]);

  return (
    <>
      {(["Trip info", "Decorate"] as const).map((group) => (
        <section key={group}>
          <h4>{group === "Trip info" ? "Shared info" : group}</h4>
          <div className="add-grid">
            {BLOCKS.filter((b) => b.group === group && b.type !== "sticker" && (!BLOCK_MODULE[b.type] || hasModule(BLOCK_MODULE[b.type]!))).map((b) => (
              <button key={b.type} onClick={() => onAdd(b.type)} title={b.description}>
                <Plus size={14} /> {BLOCK_MODULE[b.type] ? moduleName(BLOCK_MODULE[b.type]!, b.label) : b.label}
              </button>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h4>Stickers</h4>
        <div className="sticker-grid">
          {STICKERS.map((s) => (
            <button key={s.src} onClick={() => onAdd("sticker", { sticker: s.src })} title={s.label} aria-label={`Add ${s.label} sticker`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt="" />
            </button>
          ))}
          {EMOJI_STICKERS.map((e) => (
            <button key={e} onClick={() => onAdd("sticker", { sticker: e })} aria-label={`Add ${e} sticker`}>{e}</button>
          ))}
        </div>
      </section>
      <section>
        <h4>Your images</h4>
        <label className="btn btn-sm" style={{ marginBottom: "0.6rem" }}>
          {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Upload image or sticker
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            const url = await upload(f);
            setBusy(false);
            if (url) {
              setMine((m) => [{ id: url, url }, ...m]);
              onAdd(f.type === "image/png" || f.type === "image/svg+xml" ? "sticker" : "image", f.type === "image/png" || f.type === "image/svg+xml" ? { sticker: url } : { src: url });
            }
          }} />
        </label>
        {mine.length > 0 && (
          <div className="sticker-grid">
            {mine.map((m) => (
              <button key={m.id} onClick={() => onAdd("image", { src: m.url })} aria-label="Add this image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" style={{ objectFit: "cover", width: "100%", height: "100%", borderRadius: 6 }} />
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function BlockTab({ selected, onUpdate }: { selected: SelectedBlock | null; onUpdate: (p: Partial<SelectedBlock>) => void }) {
  const upload = useAssetUpload();
  const [busy, setBusy] = useState(false);
  if (!selected) return <p className="muted small">Click any block on your page to style it.</p>;
  const meta = blockMeta(selected.type);
  const style = selected.style ?? {};
  const props = selected.props ?? {};
  const setStyle = (p: Partial<BlockStyle>) => onUpdate({ style: { ...style, ...p } });
  const setProps = (p: Partial<BlockProps>) => onUpdate({ props: { ...props, ...p } });
  const textual = ["heading", "text", "quote", "divider"].includes(selected.type);

  return (
    <>
      <section>
        <h4>{meta.label}</h4>
        <p className="tiny muted">{meta.description}</p>
      </section>
      {selected.width && (
        <section>
          <h4>Width</h4>
          <Segmented<BlockWidth> size="sm" value={selected.width} onChange={(w) => onUpdate({ width: w })} options={[{ value: "third", label: "⅓" }, { value: "half", label: "½" }, { value: "two-thirds", label: "⅔" }, { value: "full", label: "Full" }]} />
        </section>
      )}
      {meta.group === "Trip info" && selected.type !== "hero" && (
        <section className="stack">
          <Field label="Title"><input className="input" value={style.title ?? ""} placeholder={meta.label} onChange={(e) => setStyle({ title: e.target.value || undefined })} /></Field>
          <label className="row small"><input type="checkbox" checked={!!style.hideTitle} onChange={(e) => setStyle({ hideTitle: e.target.checked })} /> Hide title</label>
          {(selected.type === "ideas" || selected.type === "photos") && (
            <Field label="How many to show"><input className="input" type="number" min={1} max={30} value={props.limit ?? (selected.type === "ideas" ? 6 : 8)} onChange={(e) => setProps({ limit: Number(e.target.value) || undefined })} /></Field>
          )}
        </section>
      )}
      {textual && (
        <section className="stack">
          {selected.type === "divider" ? (
            <Field label="Divider symbol"><input className="input" value={props.text ?? ""} placeholder="✦" onChange={(e) => setProps({ text: e.target.value })} /></Field>
          ) : (
            <Field label="Text"><textarea className="input textarea" value={props.text ?? ""} onChange={(e) => setProps({ text: e.target.value })} /></Field>
          )}
          <Field label="Size"><Segmented<NonNullable<BlockStyle["size"]>> size="sm" value={style.size ?? "m"} onChange={(v) => setStyle({ size: v })} options={[{ value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }, { value: "xl", label: "XL" }]} /></Field>
          <Field label="Align"><Segmented<NonNullable<BlockStyle["align"]>> size="sm" value={style.align ?? "left"} onChange={(v) => setStyle({ align: v })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} /></Field>
        </section>
      )}
      {selected.type === "sticker" && (
        <section>
          <Field label="Size"><Segmented<NonNullable<BlockStyle["size"]>> size="sm" value={style.size ?? "m"} onChange={(v) => setStyle({ size: v })} options={[{ value: "s", label: "S" }, { value: "m", label: "M" }, { value: "l", label: "L" }, { value: "xl", label: "XL" }]} /></Field>
        </section>
      )}
      {selected.type === "image" && (
        <section className="stack">
          <label className="btn btn-sm">
            {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Upload image
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              const url = await upload(f);
              setBusy(false);
              if (url) setProps({ src: url });
            }} />
          </label>
          <Field label="…or paste an image link"><input className="input" value={props.src ?? ""} onChange={(e) => setProps({ src: e.target.value })} placeholder="https://" /></Field>
        </section>
      )}
      {selected.type === "links" && <LinksEditor links={props.links ?? []} onChange={(links) => setProps({ links })} />}
      <section>
        <h4>Block colors</h4>
        <div className="swatch-row">
          <label><input type="color" value={style.bg ?? "#ffffff"} onChange={(e) => setStyle({ bg: e.target.value })} /> Background</label>
          <label><input type="color" value={style.ink ?? "#222222"} onChange={(e) => setStyle({ ink: e.target.value })} /> Text</label>
          <label><input type="color" value={style.accent ?? "#E07A5F"} onChange={(e) => setStyle({ accent: e.target.value })} /> Accent</label>
        </div>
        {(style.bg || style.ink || style.accent) && <button className="btn btn-sm btn-ghost" style={{ marginTop: 6 }} onClick={() => setStyle({ bg: undefined, ink: undefined, accent: undefined })}>Use theme colors</button>}
      </section>
      <section>
        <h4>Card</h4>
        <Segmented<CardStyle | "none" | "theme">
          size="sm"
          value={style.cardStyle ?? "theme"}
          onChange={(v) => setStyle({ cardStyle: v === "theme" ? undefined : v })}
          options={[{ value: "theme", label: "Theme" }, ...CARD_STYLES, { value: "none", label: "None" }]}
        />
      </section>
      <section>
        <h4>Font</h4>
        <select className="input" value={style.font ?? ""} onChange={(e) => setStyle({ font: e.target.value || undefined })}>
          <option value="">Theme fonts</option>
          {FONTS.map((f) => <option key={f.name} value={f.name} style={{ fontFamily: f.css }}>{f.name}</option>)}
        </select>
      </section>
    </>
  );
}

function LinksEditor({ links, onChange }: { links: { label: string; url: string }[]; onChange: (l: { label: string; url: string }[]) => void }) {
  return (
    <section className="stack">
      <h4>Links</h4>
      {links.map((l, i) => (
        <div key={i} className="row">
          <input className="input" value={l.label} placeholder="Label" onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <input className="input" value={l.url} placeholder="https://" onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
          <button className="icon-btn" aria-label="Remove link" onClick={() => onChange(links.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...links, { label: "", url: "" }])}><Plus size={14} /> Add link</button>
    </section>
  );
}

function TemplatesTab({ onApply }: { onApply: (t: Pick<Template, "theme" | "page_layout" | "board_layout">) => void }) {
  const { view } = useTrip();
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<Template[] | null>(null);
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  async function load() {
    const { data } = await supabase().from("templates").select("*").order("created_at", { ascending: false }).limit(50);
    setList((data as Template[]) ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().from("templates").insert({
      name: name.trim(),
      owner_id: user!.id,
      theme: view.theme,
      page_layout: view.page_layout,
      board_layout: view.board_layout,
      is_public: isPublic,
    });
    if (error) toast.error(friendlyError(error));
    else {
      toast.success("Template saved. Use it on any trip.");
      setName("");
      void load();
    }
  }

  const mine = list?.filter((t) => t.owner_id === user?.id) ?? [];
  const shared = list?.filter((t) => t.owner_id !== user?.id) ?? [];

  const card = (t: Template, deletable: boolean) => {
    const th = t.theme as Theme;
    return (
      <div key={t.id} className="card card-tight row" style={{ background: th.bg ?? undefined, color: th.ink ?? undefined }}>
        <div className="grow">
          <strong className="small" style={{ fontFamily: `'${th.headingFont}'` }}>{t.name}</strong>
          <div className="tiny" style={{ opacity: 0.7 }}>{t.is_public ? "Public" : "Private"} · {(t.page_layout as unknown[]).length} blocks</div>
        </div>
        <button className="btn btn-sm" onClick={() => onApply(t)}>Use</button>
        {deletable && (
          <button className="icon-btn" aria-label="Delete template" onClick={async () => {
            if (!confirm(`Delete template "${t.name}"?`)) return;
            await supabase().from("templates").delete().eq("id", t.id);
            void load();
          }}><Trash2 size={14} /></button>
        )}
      </div>
    );
  };

  return (
    <>
      <section>
        <h4>Save this design</h4>
        <form className="stack" onSubmit={save}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cozy autumn" required maxLength={120} />
          <label className="row small"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /> {isPublic ? <Globe size={13} /> : <Lock size={13} />} Let other Driftbook users use it</label>
          <button className="btn btn-sm btn-primary" disabled={!name.trim()}><Save size={14} /> Save as template</button>
        </form>
      </section>
      <section className="stack" style={{ gap: "0.4rem" }}>
        <h4>Your templates</h4>
        {list === null ? <Loader2 className="spin" size={16} /> : mine.length ? mine.map((t) => card(t, true)) : <p className="tiny muted">None yet.</p>}
      </section>
      {shared.length > 0 && (
        <section className="stack" style={{ gap: "0.4rem" }}>
          <h4>Community templates</h4>
          {shared.map((t) => card(t, false))}
        </section>
      )}
      <section>
        <h4>Start over</h4>
        <button className="btn btn-sm" onClick={() => {
          if (!confirm("Reset your view to the default layout and theme?")) return;
          const page = defaultPageLayout();
          onApply({ theme: DEFAULT_THEME, page_layout: page, board_layout: pageToBoard(page) });
        }}><RotateCcw size={14} /> Reset my view</button>
      </section>
    </>
  );
}
