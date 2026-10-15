import { fileURLToPath } from "node:url";
import { defineConfig } from "@rsbuild/core";

const pm = (name: string) =>
  fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));

export default defineConfig({
  html: {
    title: "prosemirror-breadcrumbs example",
    template: "./index.html",
  },
  resolve: {
    // The plugin source in ../src must share one copy of these packages
    // with the example, otherwise instanceof checks (NodeSelection) fail.
    alias: {
      "prosemirror-state": pm("prosemirror-state"),
      "prosemirror-view": pm("prosemirror-view"),
      "prosemirror-model": pm("prosemirror-model"),
    },
  },
});
