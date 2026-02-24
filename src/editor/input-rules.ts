import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
  InputRule,
} from 'prosemirror-inputrules';
import { Fragment, Schema } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';

// # Heading → h1, ## → h2, etc.
function headingRule(schema: Schema, level: number) {
  return textblockTypeInputRule(
    new RegExp(`^(#{1,${level}})\\s$`),
    schema.nodes.heading,
    (match) => ({ level: match[1].length }),
  );
}

// - or * → bullet list
function bulletListRule(schema: Schema) {
  return wrappingInputRule(
    /^\s*([*-])\s$/,
    schema.nodes.bullet_list,
  );
}

// 1. → ordered list
function orderedListRule(schema: Schema) {
  return wrappingInputRule(
    /^\s*(\d+)\.\s$/,
    schema.nodes.ordered_list,
    (match) => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order === +match[1],
  );
}

// > → blockquote
function blockquoteRule(schema: Schema) {
  return wrappingInputRule(
    /^\s*>\s$/,
    schema.nodes.blockquote,
  );
}

// ``` → code block
function codeBlockRule(schema: Schema) {
  return textblockTypeInputRule(
    /^```$/,
    schema.nodes.code_block,
  );
}

// ||| → create a 2x2 table
function tableRule(schema: Schema) {
  return new InputRule(/^\|\|\|$/, (state, _match, start, end) => {
    const headerCell = schema.nodes.table_header?.createAndFill();
    const dataCell = schema.nodes.table_cell?.createAndFill();
    if (!headerCell || !dataCell) return null;

    const headerRow = schema.nodes.table_row.create(null, Fragment.from([headerCell, headerCell.copy(headerCell.content)]));
    const dataRow = schema.nodes.table_row.create(null, Fragment.from([dataCell, dataCell.copy(dataCell.content)]));
    const table = schema.nodes.table.create(null, Fragment.from([headerRow, dataRow]));

    return state.tr.replaceWith(start - 1, end, table);
  });
}

export function buildInputRules(schema: Schema): Plugin {
  return inputRules({
    rules: [
      ...smartQuotes,
      emDash,
      ellipsis,
      headingRule(schema, 6),
      bulletListRule(schema),
      orderedListRule(schema),
      blockquoteRule(schema),
      codeBlockRule(schema),
      tableRule(schema),
    ],
  });
}
