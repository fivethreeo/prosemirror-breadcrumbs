import {
  EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from "prosemirror-state";
import { selectParentNode } from "prosemirror-commands";
import { Mark, Node as ProseMirrorNode } from "prosemirror-model";
import { EditorView } from "prosemirror-view";

export interface BreadcrumbNode {
  name: string;
  depth: number;
  pos: number;
  start: number;
  end: number;
  node: ProseMirrorNode;
}

export interface BreadcrumbPluginState {
  path: BreadcrumbNode[];
}

export interface BreadcrumbPluginOptions {
  showMarks?: boolean;
}

export const breadcrumbPluginKey = new PluginKey<BreadcrumbPluginState>("breadcrumbPlugin");

class BreadcrumbDOMView {
  dom: HTMLDivElement;
  private showMarks: boolean;

  constructor(view: EditorView, showMarks: boolean) {
    this.showMarks = showMarks;
    this.dom = document.createElement("div");
    this.dom.className = "ProseMirror-breadcrumb-container";
    this.dom.onmousedown = (event) => event.preventDefault();
    this.mount(view);
    this.update(view, view.state);
  }

  private mount(view: EditorView) {
    const editorDOM = view.dom;
    const parent = editorDOM.parentElement;
    if (!parent) return;

    let menuWrapper =
      parent.closest(".ProseMirror-menubar-wrapper") ||
      parent.querySelector(".ProseMirror-menubar-wrapper");

    if (!menuWrapper) {
      menuWrapper = document.createElement("div");
      menuWrapper.className = "ProseMirror-menubar-wrapper";
      parent.insertBefore(menuWrapper, editorDOM);
      menuWrapper.appendChild(editorDOM);
    }

    menuWrapper.appendChild(this.dom);
  }

  update(view: EditorView, _lastState: EditorState) {
    const path = breadcrumbPluginKey.getState(view.state)?.path || [];
    this.dom.innerHTML = "";

    path.forEach((step, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.innerText = "›";
        this.dom.appendChild(separator);
      }

      const crumb = document.createElement("span");
      crumb.innerText = step.name;
      const isSelected =
        view.state.selection instanceof NodeSelection &&
        view.state.selection.node === step.node &&
        view.state.selection.from === step.pos;
      crumb.classList.toggle("selected", isSelected);
      if (isSelected) {
        crumb.setAttribute("aria-current", "location");
      }
      crumb.onmouseover = () => {
        crumb.classList.add("active");
      };
      crumb.onmouseout = () => {
        crumb.classList.remove("active");
      };
      crumb.onclick = () => {
        const { tr, doc } = view.state;
        if (step.depth === 0) {
          console.warn("The root document container cannot be highlighted via NodeSelection.");
          return;
        }

        try {
          const child = step.node.firstChild;
          const childState =
            child && NodeSelection.isSelectable(child)
              ? view.state.apply(
                  tr.setSelection(NodeSelection.create(doc, step.start)),
                )
              : null;
          const selectedParent =
            childState &&
            selectParentNode(childState, (transaction) =>
              view.dispatch(transaction),
            );

          if (!selectedParent) {
            view.dispatch(tr.setSelection(NodeSelection.create(doc, step.pos)));
          }
          const dom = view.nodeDOM(step.pos);
          if (dom instanceof HTMLElement) {
            dom.scrollIntoView({ block: "nearest", inline: "nearest" });
          }
        } catch (error) {
          console.error(`Could not set NodeSelection on node: ${step.name}`, error);
        }
      };

      this.dom.appendChild(crumb);
    });

    if (this.showMarks) {
      const marks = getBreadcrumbMarks(view.state);
      marks.forEach((mark) => {
        const separator = document.createElement("span");
        separator.className = "separator";
        separator.innerText = "›";
        this.dom.appendChild(separator);

        const markCrumb = document.createElement("span");
        markCrumb.className = "mark";
        markCrumb.innerText = mark.type.name;
        const markRange = findMarkRange(view.state, mark);
        const isSelected =
          markRange !== null &&
          view.state.selection instanceof TextSelection &&
          view.state.selection.from === markRange.from &&
          view.state.selection.to === markRange.to;
        markCrumb.classList.toggle("selected", isSelected);
        if (isSelected) {
          markCrumb.setAttribute("aria-current", "location");
        }
        markCrumb.onclick = () => {
          if (!markRange) return;

          const selection = TextSelection.create(
            view.state.doc,
            markRange.from,
            markRange.to,
          );
          view.dispatch(view.state.tr.setSelection(selection));
        };
        this.dom.appendChild(markCrumb);
      });
    }
  }

  destroy() {
    this.dom.remove();
  }
}

export function breadcrumbPlugin(options: BreadcrumbPluginOptions = {}) {
  return new Plugin<BreadcrumbPluginState>({
    key: breadcrumbPluginKey,
    state: {
      init(_, state) {
        return { path: buildPathFromRoot(state) };
      },
      apply(tr, value, _oldState, newState) {
        if (tr.docChanged || tr.selectionSet) {
          return { path: buildPathFromRoot(newState) };
        }
        return value;
      },
    },
    view(editorView) {
      return new BreadcrumbDOMView(editorView, options.showMarks ?? false);
    },
  });
}

function getBreadcrumbMarks(state: EditorState): readonly Mark[] {
  if (state.selection.empty) {
    return state.storedMarks || state.selection.$from.marks();
  }

  const marks: Mark[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (!node.isInline) return;

    node.marks.forEach((mark) => {
      if (!marks.some((existing) => existing.eq(mark))) {
        marks.push(mark);
      }
    });
  });
  return marks;
}

function findMarkRange(
  state: EditorState,
  mark: Mark,
): { from: number; to: number } | null {
  const { $from } = state.selection;
  const parent = $from.parent;
  if (!parent.isTextblock) return null;

  const ranges: { from: number; to: number }[] = [];
  parent.forEach((node, offset) => {
    if (!node.isInline || !mark.isInSet(node.marks)) return;

    const from = $from.start() + offset;
    const to = from + node.nodeSize;
    const previous = ranges[ranges.length - 1];
    if (previous?.to === from) {
      previous.to = to;
    } else {
      ranges.push({ from, to });
    }
  });

  const pos = $from.pos;
  return (
    ranges.find(({ from, to }) => from <= pos && pos < to) ??
    ranges.find(({ from, to }) => from < pos && pos <= to) ??
    null
  );
}

function buildPathFromRoot(state: EditorState): BreadcrumbNode[] {
  const { $from, to } = state.selection;
  const path: BreadcrumbNode[] = [];
  const maxDepth = $from.sharedDepth(to);

  for (let depth = 0; depth <= maxDepth; depth++) {
    const node = $from.node(depth);
    const nodePos = depth === 0 ? 0 : $from.before(depth);

    path.push({
      name: depth === 0 ? "Document" : node.type.name,
      depth,
      pos: nodePos,
      start: $from.start(depth),
      end: $from.end(depth),
      node,
    });
  }

  if (state.selection instanceof NodeSelection) {
    const { node, from } = state.selection;
    const depth = state.selection.$from.depth + 1;
    path.push({
      name: node.type.name,
      depth,
      pos: from,
      start: from + 1,
      end: from + 1 + node.content.size,
      node,
    });
  }

  return path;
}
