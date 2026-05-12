export interface SvgPosition {
  offset: number;
  line: number;
  column: number;
}

export interface SvgLocation {
  start: SvgPosition;
  end: SvgPosition;
}

export interface SvgParseOptions {
  /**
   * Keep comment nodes in the returned tree.
   *
   * @default true
   */
  includeComments?: boolean;

  /**
   * Keep processing instructions such as `<?xml version="1.0"?>`.
   *
   * @default true
   */
  includeInstructions?: boolean;

  /**
   * Keep doctype declarations.
   *
   * @default true
   */
  includeDoctype?: boolean;

  /**
   * Keep text nodes that only contain whitespace.
   *
   * @default false
   */
  includeWhitespaceText?: boolean;

  /**
   * Decode common XML entities in text and attribute values.
   *
   * @default true
   */
  decodeEntities?: boolean;

  /**
   * Add start/end offsets, line and column to nodes.
   *
   * @default false
   */
  includePositions?: boolean;
}

export type SvgParseResult =
  | { ok: true; root: SvgRootNode }
  | { ok: false; error: Error };

export interface SvgBaseNode {
  type: string;
  location?: SvgLocation;
}

export interface SvgRootNode extends SvgBaseNode {
  type: "root";
  children: SvgNode[];
}

export interface SvgElementNode extends SvgBaseNode {
  type: "element";
  name: string;
  attributes: Record<string, string>;
  children: SvgNode[];
  selfClosing: boolean;
}

export interface SvgTextNode extends SvgBaseNode {
  type: "text";
  value: string;
}

export interface SvgCommentNode extends SvgBaseNode {
  type: "comment";
  value: string;
}

export interface SvgCdataNode extends SvgBaseNode {
  type: "cdata";
  value: string;
}

export interface SvgInstructionNode extends SvgBaseNode {
  type: "instruction";
  name: string;
  value: string;
}

export interface SvgDoctypeNode extends SvgBaseNode {
  type: "doctype";
  value: string;
}

export type SvgNode =
  | SvgElementNode
  | SvgTextNode
  | SvgCommentNode
  | SvgCdataNode
  | SvgInstructionNode
  | SvgDoctypeNode;

export interface SvgStats {
  elements: number;
  attributes: number;
  textNodes: number;
  comments: number;
  cdata: number;
  instructions: number;
  doctypes: number;
  maxDepth: number;
  elementsByName: Record<string, number>;
}

export interface SvgWalkContext {
  node: SvgRootNode | SvgNode;
  parent: SvgRootNode | SvgElementNode | null;
  depth: number;
  index: number;
}

export interface SvgFindOptions {
  /**
   * Match element names case-sensitively.
   *
   * SVG is XML-based and technically case-sensitive, but case-insensitive
   * lookup is often useful when inspecting user-provided snippets.
   *
   * @default true
   */
  caseSensitive?: boolean;
}

export interface SvgElementNameOptions {
  /**
   * Return each element name only once, preserving first-seen order.
   *
   * @default false
   */
  unique?: boolean;
}

export type SvgVisitor = (context: SvgWalkContext) => void | false;
export type SvgElementPredicate = string | ((node: SvgElementNode) => boolean);
