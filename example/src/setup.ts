import { exampleSetup } from "prosemirror-example-setup";
import { Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { Plugin } from "prosemirror-state";
import { breadcrumbPlugin } from "../../src/index";

export const exampleSchema = new Schema({
  nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
  marks: basicSchema.spec.marks,
});

export function exampleSrt(): Plugin[] {
  return [
    ...exampleSetup({ schema: exampleSchema }),
    breadcrumbPlugin({ showMarks: true }),
  ];
}
