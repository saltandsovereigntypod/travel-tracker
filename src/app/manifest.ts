import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Driftbook",
    short_name: "Driftbook",
    description: "Plan trips together. Design your own view.",
    start_url: "/trips",
    display: "standalone",
    background_color: "#FFF7ED",
    theme_color: "#E07A5F",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
