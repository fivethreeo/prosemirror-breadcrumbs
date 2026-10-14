import { DOMParser } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import "prosemirror-view/style/prosemirror.css";
import "prosemirror-menu/style/menu.css";
import "prosemirror-example-setup/style/style.css";
import { exampleSchema, exampleSrt } from "./setup";

const content = document.createElement("div");
content.innerHTML = "<p>Hello, <strong>breadcrumbs</strong>!</p><ul><li><p>Item</p></li></ul>";

new EditorView(document.querySelector("#editor")!, {
  state: EditorState.create({
    doc: DOMParser.fromSchema(exampleSchema).parse(content),
    plugins: exampleSrt(),
  }),
});
