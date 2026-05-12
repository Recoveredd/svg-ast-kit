import type { SvgPosition } from "./types.js";

export class SvgParseError extends SyntaxError {
  readonly offset: number;
  readonly line: number;
  readonly column: number;

  constructor(message: string, position: SvgPosition) {
    super(`${message} (${position.line}:${position.column})`);
    this.name = "SvgParseError";
    this.offset = position.offset;
    this.line = position.line;
    this.column = position.column;
  }
}
