import { EditorView } from "@codemirror/view";
import { parseTag, stringifyTag } from "../../core/tokenizer.js";
import {
  findNumberBoundaries,
  findTagBoundaries,
  formatNumberWithPrecision,
} from "./string-utils.js";

export const modifyNumber = (by: number, view: EditorView): boolean => {
  const selection = view.state.selection.main;
  const docText = view.state.doc.toString();

  // First try to find a number at the current position
  const numberBoundary = findNumberBoundaries(docText, selection.from);
  if (numberBoundary) {
    const newValue = parseFloat(numberBoundary.content) + by;
    const newText = formatNumberWithPrecision(newValue, numberBoundary.content);

    view.dispatch({
      changes: {
        from: numberBoundary.start,
        to: numberBoundary.end,
        insert: newText,
      },
    });
    return true;
  }

  // If no number found, try to find a tag and modify its weight
  const tagBoundary = findTagBoundaries(docText, selection.from);
  if (!tagBoundary) {
    return false;
  }

  const tag = parseTag(tagBoundary.content);
  if (!tag) {
    return false;
  }

  const newWeight = tag.weight + by;
  const newText = stringifyTag({
    ...tag,
    weight: newWeight,
    precision: Math.max(tag.precision ?? 2, 1),
  });

  view.dispatch({
    changes: {
      from: tagBoundary.start,
      to: tagBoundary.end,
      insert: newText,
    },
  });

  return true;
};
