import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const COMFY_UI_IMPORT_BASE = "../../..";

const VIRTUAL_IMPORT_PREFIX = "virtual:comfy-ui/";

export default defineConfig({
  base: "",
  publicDir: "extensions-static/comfy-ui",
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
    tailwindcss(),
    svelte(),
    {
      name: "comfy-ui-resolve",
      resolveId(source) {
        if (source.startsWith(VIRTUAL_IMPORT_PREFIX)) {
          return `#__COMFY_UI_IMPORT_BASE__#/${source.slice(VIRTUAL_IMPORT_PREFIX.length)}`;
        }
        return null;
      },
      generateBundle(_options, bundle) {
        for (const [fileName, file] of Object.entries(bundle)) {
          if (file.type === "chunk" && fileName.endsWith(".js")) {
            file.code = file.code.replace(
              /#__COMFY_UI_IMPORT_BASE__#/g,
              COMFY_UI_IMPORT_BASE,
            );
          }
        }
      },
    },
  ],
  build: {
    minify: false,
    cssMinify: "lightningcss",
    outDir: "dist-extensions/comfy-ui",
    assetsDir: "frontend/assets",
    rollupOptions: {
      external: /^#__COMFY_UI_IMPORT_BASE__#/,
      input: {
        main: "src/lib/entrypoints/comfy-ui/main.ts",
      },
      output: {
        format: "es",
        entryFileNames: "frontend/[name].js",
        chunkFileNames: "frontend/chunks/[name]-[hash].js",
        assetFileNames: "frontend/assets/[name]-[hash][extname]",
      },
    },
  },
});
