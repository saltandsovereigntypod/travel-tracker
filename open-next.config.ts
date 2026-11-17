// Driftbook renders on the client and reads data from Supabase, so no
// incremental cache (R2/KV) is needed on Cloudflare.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
