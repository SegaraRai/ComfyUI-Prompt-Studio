import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  compilerOptions: {
    customElement: true, // Enable custom elements
    warningFilter: (warning) => warning.code !== "css_unused_selector",
  },

  kit: {
    adapter: adapter(),
  },
};

export default config;
