import { EditorState, NodeSelection, Plugin, PluginKey } from "prosemirror-state";
import { Node as ProseMirrorNode } from "prosemirror-model";
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

export const breadcrumbPluginKey = new PluginKey<BreadcrumbPluginState>("breadcrumbPlugin");

class BreadcrumbDOMView {
  dom: HTMLDivElement;

  constructor(view: EditorView) {
    this.dom = document.createElement("div");
    this.dom.className = "ProseMirror-breadcrumb-container";
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
          const selection = NodeSelection.create(doc, step.pos);
          view.dispatch(tr.setSelection(selection));
          view.focus();
        } catch (error) {
          console.error(`Could not set NodeSelection on node: ${step.name}`, error);
        }
      };

      this.dom.appendChild(crumb);
    });
  }

  destroy() {
    this.dom.remove();
  }
}

export function breadcrumbPlugin() {
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
      return new BreadcrumbDOMView(editorView);
    },
  });
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

  return path;
}
