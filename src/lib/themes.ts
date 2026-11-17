import type { CSSProperties } from "react";
import type { Theme } from "./types";

export const FONTS: { name: string; css: string; kind: "serif" | "sans" | "script" | "display" | "mono" }[] = [
  { name: "Fraunces", css: "'Fraunces', Georgia, serif", kind: "serif" },
  { name: "DM Sans", css: "'DM Sans', system-ui, sans-serif", kind: "sans" },
  { name: "Playfair Display", css: "'Playfair Display', Georgia, serif", kind: "serif" },
  { name: "Cormorant Garamond", css: "'Cormorant Garamond', Georgia, serif", kind: "serif" },
  { name: "Lora", css: "'Lora', Georgia, serif", kind: "serif" },
  { name: "IM Fell English", css: "'IM Fell English', Georgia, serif", kind: "serif" },
  { name: "Cinzel", css: "'Cinzel', Georgia, serif", kind: "display" },
  { name: "Abril Fatface", css: "'Abril Fatface', Georgia, serif", kind: "display" },
  { name: "Creepster", css: "'Creepster', fantasy", kind: "display" },
  { name: "Inter", css: "'Inter', system-ui, sans-serif", kind: "sans" },
  { name: "Nunito", css: "'Nunito', system-ui, sans-serif", kind: "sans" },
  { name: "Space Grotesk", css: "'Space Grotesk', system-ui, sans-serif", kind: "sans" },
  { name: "Josefin Sans", css: "'Josefin Sans', system-ui, sans-serif", kind: "sans" },
  { name: "Caveat", css: "'Caveat', cursive", kind: "script" },
  { name: "Patrick Hand", css: "'Patrick Hand', cursive", kind: "script" },
  { name: "Shadows Into Light", css: "'Shadows Into Light', cursive", kind: "script" },
  { name: "Pacifico", css: "'Pacifico', cursive", kind: "script" },
  { name: "Special Elite", css: "'Special Elite', 'Courier New', monospace", kind: "mono" },
];

const GOOGLE_FONT_SPEC: Record<string, string> = {
  Fraunces: "Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700",
  "DM Sans": "DM+Sans:wght@400;500;600;700",
  "Playfair Display": "Playfair+Display:wght@400;600;700",
  "Cormorant Garamond": "Cormorant+Garamond:wght@400;600;700",
  Lora: "Lora:wght@400;600;700",
  "IM Fell English": "IM+Fell+English",
  Cinzel: "Cinzel:wght@400;600;700",
  "Abril Fatface": "Abril+Fatface",
  Creepster: "Creepster",
  Inter: "Inter:wght@400;500;600;700",
  Nunito: "Nunito:wght@400;600;700",
  "Space Grotesk": "Space+Grotesk:wght@400;500;700",
  "Josefin Sans": "Josefin+Sans:wght@400;600;700",
  Caveat: "Caveat:wght@400;700",
  "Patrick Hand": "Patrick+Hand",
  "Shadows Into Light": "Shadows+Into+Light",
  Pacifico: "Pacifico",
  "Special Elite": "Special+Elite",
};

export function fontCss(name: string | undefined): string {
  return FONTS.find((f) => f.name === name)?.css ?? FONTS[1].css;
}

/** Google Fonts stylesheet URL for just the fonts a theme uses. */
export function fontHref(names: (string | undefined)[]): string | null {
  const specs = [...new Set(names.filter(Boolean) as string[])]
    .map((n) => GOOGLE_FONT_SPEC[n])
    .filter(Boolean);
  if (!specs.length) return null;
  return `https://fonts.googleapis.com/css2?${specs.map((s) => `family=${s}`).join("&")}&display=swap`;
}

export const TEXTURES: Record<string, { label: string; css: string }> = {
  paper: { label: "Paper", css: "url(/stickers/paper-texture.svg)" },
  dots: {
    label: "Dot grid",
    css: "radial-gradient(color-mix(in srgb, var(--ink) 14%, transparent) 1px, transparent 1.4px) 0 0 / 22px 22px",
  },
  grid: {
    label: "Graph paper",
    css: "linear-gradient(color-mix(in srgb, var(--ink) 7%, transparent) 1px, transparent 1px) 0 0 / 28px 28px, linear-gradient(90deg, color-mix(in srgb, var(--ink) 7%, transparent) 1px, transparent 1px) 0 0 / 28px 28px",
  },
  lines: {
    label: "Notebook",
    css: "linear-gradient(transparent 31px, color-mix(in srgb, var(--accent2) 22%, transparent) 32px) 0 0 / 100% 32px",
  },
  stars: {
    label: "Stars",
    css: "radial-gradient(1.5px 1.5px at 20% 30%, color-mix(in srgb, var(--ink) 60%, transparent), transparent), radial-gradient(1px 1px at 70% 80%, color-mix(in srgb, var(--ink) 50%, transparent), transparent), radial-gradient(1.2px 1.2px at 85% 15%, color-mix(in srgb, var(--accent) 80%, transparent), transparent) 0 0 / 180px 180px",
  },
  map: { label: "Watercolor map", css: "url(/stickers/watercolor-map.svg) center / cover" },
};

export const DEFAULT_THEME: Theme = {
  preset: "paper",
  bg: "#FFF7ED",
  surface: "#FFFDF9",
  ink: "#2F3E4E",
  muted: "#6B7280",
  accent: "#E07A5F",
  accent2: "#3D5A80",
  border: "#EADFD2",
  headingFont: "Fraunces",
  bodyFont: "DM Sans",
  radius: 18,
  cardStyle: "soft",
  background: { kind: "texture", value: "paper" },
};

export const THEME_PRESETS: { id: string; name: string; theme: Theme }[] = [
  { id: "paper", name: "Paper & Ink", theme: DEFAULT_THEME },
  {
    id: "spooky",
    name: "Spooky Season",
    theme: {
      preset: "spooky",
      bg: "#1B1420",
      surface: "#2A1F31",
      ink: "#F4E9DC",
      muted: "#B7A6B9",
      accent: "#F28C28",
      accent2: "#8E6BBF",
      border: "#3E2E47",
      headingFont: "Cinzel",
      bodyFont: "Lora",
      radius: 10,
      cardStyle: "outlined",
      background: { kind: "texture", value: "stars" },
    },
  },
  {
    id: "salem",
    name: "Old Salem Parchment",
    theme: {
      preset: "salem",
      bg: "#EFE3C8",
      surface: "#F8EFDB",
      ink: "#3B2A1A",
      muted: "#7A644C",
      accent: "#8B2E1F",
      accent2: "#2F4A3A",
      border: "#D6C29C",
      headingFont: "IM Fell English",
      bodyFont: "Cormorant Garamond",
      radius: 4,
      cardStyle: "paper",
      background: { kind: "texture", value: "paper" },
    },
  },
  {
    id: "coastal",
    name: "Coastal",
    theme: {
      preset: "coastal",
      bg: "#EEF6F8",
      surface: "#FFFFFF",
      ink: "#18364A",
      muted: "#5D7887",
      accent: "#2A9D8F",
      accent2: "#E9C46A",
      border: "#D3E5EA",
      headingFont: "Playfair Display",
      bodyFont: "Nunito",
      radius: 22,
      cardStyle: "soft",
      background: { kind: "gradient", value: "linear-gradient(160deg, #EEF6F8 0%, #FDF6EC 100%)" },
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    theme: {
      preset: "midnight",
      bg: "#0F172A",
      surface: "#1E293B",
      ink: "#E2E8F0",
      muted: "#94A3B8",
      accent: "#818CF8",
      accent2: "#F472B6",
      border: "#334155",
      headingFont: "Space Grotesk",
      bodyFont: "Inter",
      radius: 14,
      cardStyle: "glass",
      background: { kind: "gradient", value: "radial-gradient(circle at 20% 0%, #312E81 0%, #0F172A 55%)" },
    },
  },
  {
    id: "minimal",
    name: "Clean Minimal",
    theme: {
      preset: "minimal",
      bg: "#FAFAFA",
      surface: "#FFFFFF",
      ink: "#111111",
      muted: "#6B6B6B",
      accent: "#111111",
      accent2: "#A3A3A3",
      border: "#E5E5E5",
      headingFont: "Inter",
      bodyFont: "Inter",
      radius: 8,
      cardStyle: "outlined",
      background: { kind: "color", value: "#FAFAFA" },
    },
  },
  {
    id: "botanical",
    name: "Botanical",
    theme: {
      preset: "botanical",
      bg: "#F1F4EC",
      surface: "#FBFCF8",
      ink: "#22331F",
      muted: "#64745F",
      accent: "#5B8C51",
      accent2: "#D98E73",
      border: "#DCE4D3",
      headingFont: "Cormorant Garamond",
      bodyFont: "Josefin Sans",
      radius: 24,
      cardStyle: "soft",
      background: { kind: "texture", value: "dots" },
    },
  },
  {
    id: "scrapbook",
    name: "Scrapbook",
    theme: {
      preset: "scrapbook",
      bg: "#FDF0E6",
      surface: "#FFFFFF",
      ink: "#3A2E39",
      muted: "#7C6A78",
      accent: "#F15BB5",
      accent2: "#00BBF9",
      border: "#F3D9C9",
      headingFont: "Caveat",
      bodyFont: "Patrick Hand",
      radius: 6,
      cardStyle: "paper",
      background: { kind: "texture", value: "grid" },
    },
  },
  {
    id: "sunset",
    name: "Sunset Postcard",
    theme: {
      preset: "sunset",
      bg: "#FFE8D6",
      surface: "#FFF8F1",
      ink: "#4A2C2A",
      muted: "#8C6A5D",
      accent: "#E76F51",
      accent2: "#264653",
      border: "#F6CDB4",
      headingFont: "Abril Fatface",
      bodyFont: "DM Sans",
      radius: 16,
      cardStyle: "soft",
      background: { kind: "gradient", value: "linear-gradient(180deg, #FFD6BA 0%, #FFE8D6 40%, #FFF4EA 100%)" },
    },
  },
];

export function resolveTheme(partial: Partial<Theme> | null | undefined): Theme {
  return { ...DEFAULT_THEME, ...(partial ?? {}), background: { ...DEFAULT_THEME.background, ...(partial?.background ?? {}) } };
}

export function backgroundCss(theme: Theme): string {
  const b = theme.background;
  if (b.kind === "color") return b.value || theme.bg;
  if (b.kind === "gradient") return b.value;
  if (b.kind === "image") return `url("${b.value.replace(/"/g, "")}") center / cover fixed, ${theme.bg}`;
  const tex = TEXTURES[b.value];
  return tex ? `${tex.css}, ${theme.bg}` : theme.bg;
}

/** CSS custom properties that every themed component reads. */
export function themeVars(theme: Theme): CSSProperties {
  return {
    "--bg": theme.bg,
    "--surface": theme.surface,
    "--ink": theme.ink,
    "--muted": theme.muted,
    "--accent": theme.accent,
    "--accent2": theme.accent2,
    "--border": theme.border,
    "--radius": `${theme.radius}px`,
    "--font-heading": fontCss(theme.headingFont),
    "--font-body": fontCss(theme.bodyFont),
    "--page-bg": backgroundCss(theme),
  } as CSSProperties;
}

/** Pick black or white text for a given background color. */
export function readableOn(hex: string): string {
  const m = hex.replace("#", "");
  if (m.length < 6) return "#111";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#1a1a1a" : "#ffffff";
}
