import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { findCommentRanges } from "../../core/comment.js";

/** Defines tailwindcss classnames. Only for prettier-plugin-tailwindcss */
function tw(cls: string): string {
  return cls;
}

export const commentPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const decorations = [];
      const doc = view.state.doc;
      const text = doc.toString();

      const commentRanges = findCommentRanges(text);
      for (const range of commentRanges) {
        decorations.push(
          Decoration.mark({
            class: tw("text-(--editor-comment-color) italic"),
          }).range(range.start, range.end),
        );
      }

      return Decoration.set(decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
