import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: false,
  clean: true,
  sourcemap: true,
  // Third-party runtime deps stay external — declared in `dependencies`, npm
  // installs them. (Bundling commander, which is CommonJS, into ESM breaks its
  // internal `require` calls.) But the internal registry-core schema and its
  // only dep, zod, ARE bundled in: registry-core is private and never published,
  // so the CLI must carry it. zod bundles cleanly (pure JS, no dynamic require).
  noExternal: ["@dither-kit/registry-core", "zod"],
  shims: true,
  banner: { js: "#!/usr/bin/env node" },
})
