export { SvgParseError } from "./errors.js";
export { decodeSvgEntities } from "./entities.js";
export type {
  SvgCdataNode,
  SvgCommentNode,
  SvgDoctypeNode,
  SvgElementNode,
  SvgElementPredicate,
  SvgFindOptions,
  SvgInstructionNode,
  SvgLocation,
  SvgNode,
  SvgParseOptions,
  SvgParseResult,
  SvgPosition,
  SvgRootNode,
  SvgStats,
  SvgTextNode,
  SvgVisitor,
  SvgWalkContext
} from "./types.js";

import { decodeSvgEntities } from "./entities.js";
import { SvgParseError } from "./errors.js";
import { positionAt } from "./position.js";
import type {
  SvgCdataNode,
  SvgCommentNode,
  SvgDoctypeNode,
  SvgElementNode,
  SvgElementPredicate,
  SvgFindOptions,
  SvgInstructionNode,
  SvgNode,
  SvgParseOptions,
  SvgParseResult,
  SvgRootNode,
  SvgStats,
  SvgTextNode,
  SvgVisitor
} from "./types.js";

type ParentNode = SvgRootNode | SvgElementNode;

const nameStartPattern = /[A-Za-z_:]/u;
const namePattern = /[A-Za-z0-9_:.-]/u;

const defaultOptions = {
  includeComments: true,
  includeInstructions: true,
  includeDoctype: true,
  includeWhitespaceText: false,
  decodeEntities: true,
  includePositions: false
} satisfies Required<SvgParseOptions>;

export function parseSvg(source: string, options: SvgParseOptions = {}): SvgRootNode {
  const parser = new Parser(String(source), { ...defaultOptions, ...options });
  return parser.parse();
}

export function tryParseSvg(source: string, options: SvgParseOptions = {}): SvgParseResult {
  try {
    return { ok: true, root: parseSvg(source, options) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error("Unknown SVG parse error.") };
  }
}

export function svgToJson(source: string, options: SvgParseOptions = {}, space: number | string = 2): string {
  return JSON.stringify(parseSvg(source, options), null, space);
}

export function walkSvg(root: SvgRootNode | SvgNode, visitor: SvgVisitor): void {
  const visit = (
    node: SvgRootNode | SvgNode,
    parent: ParentNode | null,
    depth: number,
    index: number
  ): void => {
    const result = visitor({ node, parent, depth, index });

    if (result === false) {
      return;
    }

    if (node.type === "root" || node.type === "element") {
      node.children.forEach((child, childIndex) => visit(child, node, depth + 1, childIndex));
    }
  };

  visit(root, null, 0, 0);
}

export function findSvgElements(
  root: SvgRootNode | SvgNode,
  predicate: SvgElementPredicate,
  options: SvgFindOptions = {}
): SvgElementNode[] {
  const elements: SvgElementNode[] = [];
  const { caseSensitive = true } = options;
  const matches = createElementMatcher(predicate, caseSensitive);

  walkSvg(root, ({ node }) => {
    if (node.type === "element" && matches(node)) {
      elements.push(node);
    }
  });

  return elements;
}

export function findFirstSvgElement(
  root: SvgRootNode | SvgNode,
  predicate: SvgElementPredicate,
  options: SvgFindOptions = {}
): SvgElementNode | undefined {
  const { caseSensitive = true } = options;
  const matches = createElementMatcher(predicate, caseSensitive);

  const find = (node: SvgRootNode | SvgNode): SvgElementNode | undefined => {
    if (node.type === "element" && matches(node)) {
      return node;
    }

    if (node.type !== "root" && node.type !== "element") {
      return undefined;
    }

    for (const child of node.children) {
      const match = find(child);

      if (match) {
        return match;
      }
    }

    return undefined;
  };

  return find(root);
}

export function getSvgRootElement(root: SvgRootNode | SvgNode): SvgElementNode | undefined {
  return findFirstSvgElement(root, "svg", { caseSensitive: false });
}

function createElementMatcher(
  predicate: SvgElementPredicate,
  caseSensitive: boolean
): (node: SvgElementNode) => boolean {
  if (typeof predicate !== "string") {
    return predicate;
  }

  const needle = caseSensitive ? predicate : predicate.toLowerCase();

  return (node): boolean => caseSensitive ? node.name === needle : node.name.toLowerCase() === needle;
}

export function getSvgStats(root: SvgRootNode | SvgNode): SvgStats {
  const stats: SvgStats = {
    elements: 0,
    attributes: 0,
    textNodes: 0,
    comments: 0,
    cdata: 0,
    instructions: 0,
    doctypes: 0,
    maxDepth: 0,
    elementsByName: {}
  };

  walkSvg(root, ({ node, depth }) => {
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    if (node.type === "element") {
      stats.elements += 1;
      stats.attributes += Object.keys(node.attributes).length;
      stats.elementsByName[node.name] = (stats.elementsByName[node.name] ?? 0) + 1;
    } else if (node.type === "text") {
      stats.textNodes += 1;
    } else if (node.type === "comment") {
      stats.comments += 1;
    } else if (node.type === "cdata") {
      stats.cdata += 1;
    } else if (node.type === "instruction") {
      stats.instructions += 1;
    } else if (node.type === "doctype") {
      stats.doctypes += 1;
    }
  });

  return stats;
}

class Parser {
  private index = 0;
  private readonly root: SvgRootNode = { type: "root", children: [] };
  private readonly stack: ParentNode[] = [this.root];

  constructor(
    private readonly source: string,
    private readonly options: Required<SvgParseOptions>
  ) {}

  parse(): SvgRootNode {
    while (!this.isAtEnd()) {
      if (this.startsWith("<!--")) {
        this.parseComment();
      } else if (this.startsWith("<![CDATA[")) {
        this.parseCdata();
      } else if (this.startsWith("<!DOCTYPE") || this.startsWith("<!doctype")) {
        this.parseDoctype();
      } else if (this.startsWith("<?")) {
        this.parseInstruction();
      } else if (this.startsWith("</")) {
        this.parseClosingTag();
      } else if (this.peek() === "<") {
        this.parseElement();
      } else {
        this.parseText();
      }
    }

    if (this.stack.length > 1) {
      const openElement = this.stack[this.stack.length - 1] as SvgElementNode;
      this.fail(`Missing closing tag for <${openElement.name}>`, this.source.length);
    }

    return this.withLocation(this.root, 0, this.source.length);
  }

  private parseComment(): void {
    const start = this.index;
    const end = this.source.indexOf("-->", this.index + 4);

    if (end === -1) {
      this.fail("Unclosed comment", start);
    }

    this.index = end + 3;

    if (!this.options.includeComments) {
      return;
    }

    const node: SvgCommentNode = {
      type: "comment",
      value: this.source.slice(start + 4, end)
    };

    this.addNode(this.withLocation(node, start, this.index));
  }

  private parseCdata(): void {
    const start = this.index;
    const end = this.source.indexOf("]]>", this.index + 9);

    if (end === -1) {
      this.fail("Unclosed CDATA section", start);
    }

    this.index = end + 3;
    this.addNode(this.withLocation({
      type: "cdata",
      value: this.source.slice(start + 9, end)
    } satisfies SvgCdataNode, start, this.index));
  }

  private parseDoctype(): void {
    const start = this.index;
    const end = this.source.indexOf(">", this.index + 2);

    if (end === -1) {
      this.fail("Unclosed doctype declaration", start);
    }

    this.index = end + 1;

    if (!this.options.includeDoctype) {
      return;
    }

    this.addNode(this.withLocation({
      type: "doctype",
      value: this.source.slice(start + 2, end).trim()
    } satisfies SvgDoctypeNode, start, this.index));
  }

  private parseInstruction(): void {
    const start = this.index;
    const end = this.source.indexOf("?>", this.index + 2);

    if (end === -1) {
      this.fail("Unclosed processing instruction", start);
    }

    const content = this.source.slice(start + 2, end).trim();
    const nameEnd = content.search(/\s/u);
    const name = nameEnd === -1 ? content : content.slice(0, nameEnd);
    const value = nameEnd === -1 ? "" : content.slice(nameEnd + 1).trim();
    this.index = end + 2;

    if (!this.options.includeInstructions) {
      return;
    }

    this.addNode(this.withLocation({
      type: "instruction",
      name,
      value
    } satisfies SvgInstructionNode, start, this.index));
  }

  private parseClosingTag(): void {
    const start = this.index;
    this.index += 2;
    this.skipWhitespace();
    const name = this.readName();
    this.skipWhitespace();
    this.expect(">");

    const current = this.stack[this.stack.length - 1];

    if (!current || current.type !== "element") {
      this.fail(`Unexpected closing tag </${name}>`, start);
    }

    if (current.name !== name) {
      this.fail(`Expected closing tag </${current.name}> but found </${name}>`, start);
    }

    const element = this.stack.pop() as SvgElementNode;
    this.withLocation(element, element.location?.start.offset ?? start, this.index);
  }

  private parseElement(): void {
    const start = this.index;
    this.expect("<");
    const name = this.readName();
    const attributes: Record<string, string> = {};
    let selfClosing = false;

    while (!this.isAtEnd()) {
      this.skipWhitespace();

      if (this.startsWith("/>")) {
        selfClosing = true;
        this.index += 2;
        break;
      }

      if (this.peek() === ">") {
        this.index += 1;
        break;
      }

      const attributeName = this.readName();

      if (Object.prototype.hasOwnProperty.call(attributes, attributeName)) {
        this.fail(`Duplicate attribute "${attributeName}" on <${name}>`, this.index);
      }

      this.skipWhitespace();
      this.expect("=");
      this.skipWhitespace();
      attributes[attributeName] = this.readAttributeValue();
    }

    if (this.isAtEnd() && this.source[this.index - 1] !== ">") {
      this.fail(`Unclosed start tag <${name}>`, start);
    }

    const element = this.withLocation({
      type: "element",
      name,
      attributes,
      children: [],
      selfClosing
    } satisfies SvgElementNode, start, this.index);

    this.addNode(element);

    if (!selfClosing) {
      this.stack.push(element);
    }
  }

  private parseText(): void {
    const start = this.index;
    const next = this.source.indexOf("<", this.index);
    const end = next === -1 ? this.source.length : next;
    this.index = end;

    const rawValue = this.source.slice(start, end);

    if (!this.options.includeWhitespaceText && rawValue.trim() === "") {
      return;
    }

    const value = this.options.decodeEntities ? decodeSvgEntities(rawValue) : rawValue;

    this.addNode(this.withLocation({
      type: "text",
      value
    } satisfies SvgTextNode, start, end));
  }

  private readName(): string {
    const start = this.index;

    if (!nameStartPattern.test(this.peek() ?? "")) {
      this.fail("Expected a tag or attribute name", this.index);
    }

    this.index += 1;

    while (!this.isAtEnd() && namePattern.test(this.peek() ?? "")) {
      this.index += 1;
    }

    return this.source.slice(start, this.index);
  }

  private readAttributeValue(): string {
    const quote = this.peek();

    if (quote !== "\"" && quote !== "'") {
      this.fail("Expected a quoted attribute value", this.index);
    }

    this.index += 1;
    const start = this.index;
    const end = this.source.indexOf(quote, this.index);

    if (end === -1) {
      this.fail("Unclosed attribute value", start - 1);
    }

    this.index = end + 1;
    const rawValue = this.source.slice(start, end);

    return this.options.decodeEntities ? decodeSvgEntities(rawValue) : rawValue;
  }

  private addNode(node: SvgNode): void {
    this.currentParent().children.push(node);
  }

  private currentParent(): ParentNode {
    const parent = this.stack[this.stack.length - 1];

    if (!parent) {
      this.fail("Parser stack is empty", this.index);
    }

    return parent;
  }

  private withLocation<TNode extends SvgRootNode | SvgNode>(node: TNode, start: number, end: number): TNode {
    if (this.options.includePositions) {
      node.location = {
        start: positionAt(this.source, start),
        end: positionAt(this.source, end)
      };
    }

    return node;
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && /\s/u.test(this.peek() ?? "")) {
      this.index += 1;
    }
  }

  private expect(value: string): void {
    if (!this.startsWith(value)) {
      this.fail(`Expected "${value}"`, this.index);
    }

    this.index += value.length;
  }

  private startsWith(value: string): boolean {
    return this.source.startsWith(value, this.index);
  }

  private peek(): string | undefined {
    return this.source[this.index];
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  private fail(message: string, offset: number): never {
    throw new SvgParseError(message, positionAt(this.source, offset));
  }
}
