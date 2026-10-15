// @vitest-environment jsdom

import { NodeSelection, TextSelection, EditorState } from "prosemirror-state";
import { Schema } from "prosemirror-model";
import { EditorView } from "prosemirror-view";
import { describe, expect, it } from "vitest";
import { breadcrumbPlugin, breadcrumbPluginKey } from "../src/index.js";

const schema = new Schema({
  nodes: {
    doc: { content: "block+", toDOM: () => ["div", 0] },
    paragraph: { content: "text*", group: "block", toDOM: () => ["p", 0] },
    blockquote: {
      content: "block+",
      group: "block",
      toDOM: () => ["blockquote", 0],
    },
    text: { group: "inline" },
  },
  marks: {
    strong: { toDOM: () => ["strong", 0] },
  },
});

function nestedDocument() {
  return schema.node("doc", null, [
    schema.node("blockquote", null, [
      schema.node("paragraph", null, [schema.text("nested")]),
    ]),
    schema.node("paragraph", null, [schema.text("outside")]),
  ]);
}

describe("breadcrumbPlugin", () => {
  it("builds a root-to-selection path with node positions", () => {
    const doc = nestedDocument();
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 4),
      plugins: [breadcrumbPlugin()],
    });
    const path = breadcrumbPluginKey.getState(state)?.path;

    expect(path?.map(({ name }) => name)).toEqual([
      "Document",
      "blockquote",
      "paragraph",
    ]);
    expect(path?.map(({ depth, pos }) => [depth, pos])).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
    ]);
    expect(path?.map(({ node }) => node.type.name)).toEqual([
      "doc",
      "blockquote",
      "paragraph",
    ]);
  });

  it("recomputes the path when the selection moves to a different block", () => {
    const doc = nestedDocument();
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 4),
      plugins: [breadcrumbPlugin()],
    });

    const nextState = state.apply(
      state.tr.setSelection(TextSelection.create(doc, 12)),
    );

    expect(breadcrumbPluginKey.getState(nextState)?.path.map(({ name }) => name))
      .toEqual(["Document", "paragraph"]);
    expect(breadcrumbPluginKey.getState(nextState)?.path[1].pos).toBe(10);
  });

  it("includes and highlights a selected node in the breadcrumb path", () => {
    const doc = nestedDocument();
    const state = EditorState.create({
      doc,
      selection: NodeSelection.create(doc, 0),
      plugins: [breadcrumbPlugin()],
    });
    const path = breadcrumbPluginKey.getState(state)?.path;
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      expect(path?.map(({ name }) => name)).toEqual(["Document", "blockquote"]);
      expect(path?.[1].pos).toBe(0);

      const selectedCrumb = mount.querySelector(".selected");
      expect((selectedCrumb as HTMLElement | null)?.innerText).toBe("blockquote");
      expect(selectedCrumb?.getAttribute("aria-current")).toBe("location");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  it("selects the node represented by a clicked breadcrumb", () => {
    const doc = nestedDocument();
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 4),
      plugins: [breadcrumbPlugin()],
    });
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      const crumbs = mount.querySelector(".ProseMirror-breadcrumb-container");
      const blockquoteCrumb = crumbs?.children[2] as HTMLElement | undefined;

      expect(blockquoteCrumb).toBeDefined();
      expect(blockquoteCrumb?.innerText).toBe("blockquote");
      const mouseDown = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      (blockquoteCrumb as HTMLElement).dispatchEvent(mouseDown);
      expect(mouseDown.defaultPrevented).toBe(true);
      (blockquoteCrumb as HTMLElement).click();

      expect(view.state.selection).toBeInstanceOf(NodeSelection);
      expect(view.state.selection.from).toBe(0);
      expect(view.state.selection.to).toBe(
        view.state.selection.from + doc.firstChild!.nodeSize,
      );
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  it("shows active marks when the option is enabled", () => {
    const markedText = schema.text("nested", [schema.mark("strong")]);
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [markedText]),
    ]);
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 4),
      plugins: [breadcrumbPlugin({ showMarks: true })],
    });
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      expect(
        (mount.querySelector(
          ".ProseMirror-breadcrumb-container > span.mark",
        ) as HTMLElement | null)?.innerText,
      ).toBe("strong");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  it("selects and highlights the marked text when its breadcrumb is clicked", () => {
    const markedText = schema.text("nested", [schema.mark("strong")]);
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [
        schema.text("before "),
        markedText,
        schema.text(" after"),
      ]),
    ]);
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 10),
      plugins: [breadcrumbPlugin({ showMarks: true })],
    });
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      const markCrumb = mount.querySelector(
        ".ProseMirror-breadcrumb-container > span.mark",
      ) as HTMLElement;
      markCrumb.click();

      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.doc.textBetween(
        view.state.selection.from,
        view.state.selection.to,
      )).toBe("nested");
      const selectedMarkCrumb = mount.querySelector(
        ".ProseMirror-breadcrumb-container > span.mark.selected",
      );
      expect(selectedMarkCrumb).not.toBeNull();
      expect(selectedMarkCrumb?.getAttribute("aria-current")).toBe("location");
    } finally {
      view.destroy();
      mount.remove();
    }
  });

  it("does not show active marks by default", () => {
    const markedText = schema.text("nested", [schema.mark("strong")]);
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [markedText]),
    ]);
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 4),
      plugins: [breadcrumbPlugin()],
    });
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const view = new EditorView(mount, { state });

    try {
      expect(
        mount.querySelector(".ProseMirror-breadcrumb-container > span.mark"),
      ).toBeNull();
    } finally {
      view.destroy();
      mount.remove();
    }
  });
});
