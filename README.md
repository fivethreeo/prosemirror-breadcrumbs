# prosemirror-breadcrumbs

Breadcrumb navigation for ProseMirror editors. The plugin displays the path from the document root to the current selection and lets users select an ancestor node by clicking its breadcrumb.

## Install

```sh
npm install prosemirror-breadcrumbs
```

## Use

Add `breadcrumbPlugin()` to your editor's plugins and import the stylesheet:

```ts
import { breadcrumbPlugin } from "prosemirror-breadcrumbs";
import "prosemirror-breadcrumbs/style/breadcrumbs.css";

const state = EditorState.create({
  schema,
  doc,
  plugins: [...plugins, breadcrumbPlugin()],
});
```

The plugin renders a breadcrumb for the document and each ancestor shared by the selection's endpoints. Clicking a node breadcrumb selects that node with a ProseMirror `NodeSelection`; the document-root breadcrumb is not selectable. If the selection is already a `NodeSelection`, the selected node is also represented in the path.

## Bundlers and ProseMirror module instances

The editor and this plugin must use the same instances of `prosemirror-model`, `prosemirror-state`, and `prosemirror-view`. If a bundler includes duplicate copies, `instanceof` checks such as the plugin's `NodeSelection` check can fail. Configure your package manager or bundler to deduplicate these modules; the [example's Rsbuild config](./example/rsbuild.config.ts) aliases them to the example's copies.

## Options

Pass `{ showMarks: true }` to `breadcrumbPlugin` to show active marks as breadcrumbs. Mark breadcrumbs are disabled by default.

## Read the breadcrumb path

The current path is available from the plugin state:

```ts
import { breadcrumbPluginKey } from "prosemirror-breadcrumbs";

const path = breadcrumbPluginKey.getState(view.state)?.path ?? [];
```

Each `BreadcrumbNode` contains:

- `name`: node type name (`"Document"` for the root)
- `depth`: nesting depth
- `pos`: node position in the document
- `start` and `end`: positions at the start and end of the node's content
- `node`: the corresponding ProseMirror node

## Example

The [`example/`](./example) directory contains a runnable ProseMirror editor with the breadcrumb plugin.

To run it locally:

```sh
cd example
npm ci
npm run dev
```

The development server opens the example in your browser. To build the example for production, run `npm run build` from the `example/` directory.

## Development

From the repository root:

- `npm test` runs the plugin tests.
- `npm run typecheck` checks source and test TypeScript.
- `npm run build` builds the package into `dist/`.
