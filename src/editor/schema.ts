import { Schema } from 'prosemirror-model';
import { schema as markdownSchema } from 'prosemirror-markdown';
import { tableNodes } from 'prosemirror-tables';

// Generate table node specs from prosemirror-tables
const tableNodeSpecs = tableNodes({
  tableGroup: 'block',
  cellContent: 'inline*',
  cellAttributes: {
    textAlign: {
      default: null,
      getFromDOM(dom: HTMLElement) {
        return dom.style.textAlign || null;
      },
      setDOMAttr(value, attrs) {
        if (value) attrs.style = ((attrs.style as string) || '') + `text-align: ${value};`;
      },
    },
  },
});

// Build new schema extending the default markdown schema with table nodes
const nodes = markdownSchema.spec.nodes.append(tableNodeSpecs);

export const schema = new Schema({
  nodes,
  marks: markdownSchema.spec.marks,
});
