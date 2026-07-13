import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: false,
  clean: true,
  sourcemap: true,
  // Keep runtime deps external — they're declared in `dependencies` and npm
  // installs them. Bundling commander (CommonJS) into ESM breaks its internal
  // `require` calls, so we don't.
  shims: true,
  banner: { js: "#!/usr/bin/env node" },
})
