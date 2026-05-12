import type { SvgPosition } from "./types.js";

export function positionAt(source: string, offset: number): SvgPosition {
  let line = 1;
  let column = 1;
  let index = 0;

  while (index < offset) {
    const char = source[index];

    if (char === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }

    index += 1;
  }

  return { offset, line, column };
}
