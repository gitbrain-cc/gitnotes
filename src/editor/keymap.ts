import { keymap } from 'prosemirror-keymap';
import { baseKeymap, createParagraphNear, liftEmptyBlock, splitBlock, chainCommands } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import {
  sinkListItem,
  liftListItem,
  splitListItem,
} from 'prosemirror-schema-list';
import { Plugin, EditorState } from 'prosemirror-state';

// Get list_item from the actual document's schema to avoid type mismatches
function getListItemType(state: EditorState) {
  return state.schema.nodes.list_item;
}

export function buildKeymap(): Plugin {
  return keymap({
    ...baseKeymap,
    'Mod-z': undo,
    'Mod-Shift-z': redo,
    'Mod-y': redo,
    'Tab': (state, dispatch) => {
      const listItemType = getListItemType(state);
      if (sinkListItem(listItemType)(state, dispatch)) {
        return true;
      }
      // Consume Tab in list items to prevent focus loss
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'list_item') {
          return true;
        }
      }
      return false;
    },
    'Shift-Tab': (state, dispatch) => {
      const listItemType = getListItemType(state);
      if (liftListItem(listItemType)(state, dispatch)) {
        return true;
      }
      // Consume Shift-Tab in list items to prevent focus loss
      const { $from } = state.selection;
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'list_item') {
          return true;
        }
      }
      return false;
    },
    'Enter': chainCommands(
      (state, dispatch) => splitListItem(getListItemType(state))(state, dispatch),
      createParagraphNear,
      liftEmptyBlock,
      splitBlock,
    ),
  });
}
