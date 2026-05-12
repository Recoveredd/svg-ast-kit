import { describe, expect, it } from "vitest";
import {
  decodeSvgEntities,
  findFirstSvgElement,
  findSvgElements,
  getSvgElementNames,
  getSvgRootElement,
  getSvgStats,
  parseSvg,
  SvgParseError,
  svgToJson,
  tryParseSvg,
  walkSvg
} from "../src/index.js";

describe("parseSvg", () => {
  it("parses SVG elements, attributes and text", () => {
    const root = parseSvg(`<svg viewBox="0 0 10 10"><title>Icon &amp; mark</title><use xlink:href="#shape" data-id="mark" /><circle cx="5" cy="5" r="4" /></svg>`);
    const svg = root.children[0];

    expect(svg).toMatchObject({
      type: "element",
      name: "svg",
      attributes: { viewBox: "0 0 10 10" },
      selfClosing: false
    });

    expect(findSvgElements(root, "circle")[0]).toMatchObject({
      type: "element",
      name: "circle",
      attributes: { cx: "5", cy: "5", r: "4" },
      children: [],
      selfClosing: true
    });
    expect(findSvgElements(root, "title")[0]?.children[0]).toEqual({
      type: "text",
      value: "Icon & mark"
    });
    expect(findSvgElements(root, "use")[0]?.attributes).toEqual({
      "data-id": "mark",
      "xlink:href": "#shape"
    });
  });

  it("keeps comments, cdata, doctype and instructions by default", () => {
    const root = parseSvg(`<?xml version="1.0"?><!DOCTYPE svg><!-- note --><svg><style><![CDATA[a > b]]></style></svg>`);

    expect(root.children.map((node) => node.type)).toEqual(["instruction", "doctype", "comment", "element"]);
    expect(findSvgElements(root, "style")[0]?.children[0]).toEqual({
      type: "cdata",
      value: "a > b"
    });
  });

  it("can omit comments and whitespace-only text", () => {
    const root = parseSvg(`<svg>\n  <!-- hidden -->\n  <g />\n</svg>`, {
      includeComments: false
    });

    expect(root.children[0]).toMatchObject({
      type: "element",
      children: [
        {
          type: "element",
          name: "g"
        }
      ]
    });
  });

  it("can include position metadata", () => {
    const root = parseSvg(`<svg>\n  <path d="M0 0" />\n</svg>`, { includePositions: true });
    const path = findSvgElements(root, "path")[0];

    expect(root.location?.start).toEqual({ offset: 0, line: 1, column: 1 });
    expect(path?.location?.start).toEqual({ offset: 8, line: 2, column: 3 });
  });

  it("throws readable errors for mismatched tags", () => {
    expect(() => parseSvg(`<svg><g></svg>`)).toThrow(SvgParseError);

    try {
      parseSvg(`<svg><g></svg>`);
    } catch (error) {
      expect(error).toBeInstanceOf(SvgParseError);
      expect((error as SvgParseError).message).toContain("Expected closing tag </g> but found </svg>");
      expect((error as SvgParseError).line).toBe(1);
    }
  });

  it("throws for duplicate attributes", () => {
    expect(() => parseSvg(`<svg><path d="M0 0" d="M1 1" /></svg>`)).toThrow(/Duplicate attribute "d"/u);
  });

  it("throws for unquoted attributes", () => {
    expect(() => parseSvg(`<svg viewBox=0></svg>`)).toThrow(/Expected a quoted attribute value/u);
  });

  it("serializes directly to JSON", () => {
    expect(svgToJson(`<svg><path d="M0 0" /></svg>`)).toContain('"name": "path"');
  });

  it("returns a result object for safe parsing", () => {
    expect(tryParseSvg(`<svg />`)).toMatchObject({ ok: true });

    const result = tryParseSvg(`<svg>`);
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error).toBeInstanceOf(SvgParseError);
  });
});

describe("helpers", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeSvgEntities("&lt; &#65; &#x42; &unknown;")).toBe("< A B &unknown;");
  });

  it("walks nodes and can stop descending", () => {
    const root = parseSvg(`<svg><g><path /></g><circle /></svg>`);
    const names: string[] = [];

    walkSvg(root, ({ node }) => {
      if (node.type !== "element") {
        return;
      }

      names.push(node.name);

      if (node.name === "g") {
        return false;
      }
    });

    expect(names).toEqual(["svg", "g", "circle"]);
  });

  it("collects stats", () => {
    const root = parseSvg(`<svg viewBox="0 0 10 10"><g id="a"><path d="M0 0" /></g><circle /></svg>`);

    expect(getSvgStats(root)).toMatchObject({
      elements: 4,
      attributes: 3,
      maxDepth: 3,
      elementsByName: {
        svg: 1,
        g: 1,
        path: 1,
        circle: 1
      }
    });
  });

  it("lists element names in document order", () => {
    const root = parseSvg(`<svg><g><path /></g><g><circle /></g></svg>`);

    expect(getSvgElementNames(root)).toEqual(["svg", "g", "path", "g", "circle"]);
    expect(getSvgElementNames(root, { unique: true })).toEqual(["svg", "g", "path", "circle"]);
  });

  it("finds the first matching element and root svg element", () => {
    const root = parseSvg(`<SVG><g><path id="first" /></g><path id="second" /></SVG>`);

    expect(getSvgRootElement(root)?.name).toBe("SVG");
    expect(findFirstSvgElement(root, "path")?.attributes.id).toBe("first");
    expect(findSvgElements(root, "svg")).toHaveLength(0);
    expect(findSvgElements(root, "svg", { caseSensitive: false })).toHaveLength(1);
  });
});
