import {
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
  smartQuotes,
  emDash,
  ellipsis,
} from 'prosemirror-inputrules';
import { Schema } from 'prosemirror-model';
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
    ],
  });
}
