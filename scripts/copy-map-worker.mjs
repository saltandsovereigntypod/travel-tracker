// MapLibre runs map rendering in a Web Worker loaded from a separate file.
// Bundlers can't follow that file, so copy it into /public where the app can load it.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
