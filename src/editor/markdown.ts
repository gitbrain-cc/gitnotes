import markdownit from 'markdown-it';
import { MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { schema } from './schema';
import { Node as PMNode } from 'prosemirror-model';

// --- PARSER ---

// Get the default token spec and extend with table tokens
const defaultTokens = (defaultMarkdownParser as any).tokens;

export const markdownParser = new MarkdownParser(
  schema,
  markdownit('commonmark', { html: false }).enable('table'),
  {
    ...defaultTokens,
    table: { block: 'table' },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: 'table_row' },
    th: {
      block: 'table_header',
      getAttrs: (tok: any) => {
        const style = tok.attrGet?.('style') || '';
        const match = style.match(/text-align:\s*(\w+)/);
        return match ? { textAlign: match[1] } : {};
      },
    },
    td: {
      block: 'table_cell',
      getAttrs: (tok: any) => {
        const style = tok.attrGet?.('style') || '';
        const match = style.match(/text-align:\s*(\w+)/);
        return match ? { textAlign: match[1] } : {};
      },
    },
  },
);

// --- SERIALIZER ---

const defaultNodes = defaultMarkdownSerializer.nodes;
const defaultMarks = defaultMarkdownSerializer.marks;

function serializeCell(node: PMNode): string {
  let text = '';
  node.forEach((inline: PMNode) => {
    if (inline.isText) {
      let t = inline.text || '';
      // Escape pipes in cell content
      t = t.replace(/\|/g, '\\|');
      const hasCode = inline.marks.some(m => m.type.name === 'code');
      if (hasCode) {
        t = `\`${t}\``;
      } else {
        inline.marks.forEach(mark => {
          if (mark.type.name === 'strong') t = `**${t}**`;
          if (mark.type.name === 'em') t = `*${t}*`;
          if (mark.type.name === 'link') t = `[${t}](${mark.attrs.href})`;
        });
      }
      text += t;
    } else if (inline.type.name === 'hard_break') {
      text += '<br>';
    }
  });
  return text;
}

function getAlignmentSeparator(align: string | null): string {
  switch (align) {
    case 'left': return ':---';
    case 'center': return ':---:';
    case 'right': return '---:';
    default: return '---';
  }
}

export const markdownSerializer = new MarkdownSerializer(
  {
    ...defaultNodes,
    table(state: any, node: PMNode) {
      const rows: PMNode[] = [];
      node.forEach((row: PMNode) => rows.push(row));

      if (rows.length === 0) return;

      // Serialize header row (first row, assumed to be table_header cells)
      const headerRow = rows[0];
      const headerCells: string[] = [];
      const alignments: (string | null)[] = [];
      headerRow.forEach((cell: PMNode) => {
        headerCells.push(serializeCell(cell));
        alignments.push(cell.attrs.textAlign || null);
      });

      // Write header
      state.write('| ' + headerCells.join(' | ') + ' |\n');

      // Write separator
      const separators = alignments.map((a: string | null) => getAlignmentSeparator(a));
      state.write('| ' + separators.join(' | ') + ' |\n');

      // Write data rows
      for (let i = 1; i < rows.length; i++) {
        const cells: string[] = [];
        rows[i].forEach((cell: PMNode) => {
          cells.push(serializeCell(cell));
        });
        state.write('| ' + cells.join(' | ') + ' |\n');
      }

      state.closeBlock(node);
    },
    table_row() {
      // Handled by table serializer
    },
    table_header(state: any, node: PMNode) {
      state.renderInline(node);
    },
    table_cell(state: any, node: PMNode) {
      state.renderInline(node);
    },
  },
  {
    ...defaultMarks,
  },
);
