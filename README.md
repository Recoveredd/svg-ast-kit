# svg-ast-kit

Convert SVG strings into typed JSON trees with readable errors.

`svg-ast-kit` is a small clean-room SVG-to-JSON parser for tooling, previews, audits and browser demos. It does not render SVG and it does not execute scripts. It turns SVG markup into a predictable object tree that can be inspected, transformed or serialized to JSON.

## Install

```bash
npm install svg-ast-kit
```

## Demo

Try the live demo: https://packages.wasta-wocket.fr/svg-ast-kit/

## Quick Start

```ts
import { findSvgElements, getSvgRootElement, getSvgStats, parseSvg, svgToJson } from "svg-ast-kit";

const tree = parseSvg(`
  <svg viewBox="0 0 10 10">
    <circle cx="5" cy="5" r="4" />
  </svg>
`);

findSvgElements(tree, "circle");
// [{ type: "element", name: "circle", attributes: { cx: "5", cy: "5", r: "4" }, ... }]

getSvgRootElement(tree)?.attributes.viewBox;
// "0 0 10 10"

getSvgStats(tree);
// { elements: 2, attributes: 4, maxDepth: 2, ... }

svgToJson(`<svg><path d="M0 0" /></svg>`);
// "{ ... }"
```

## API

### `parseSvg(source, options?)`

Returns a `SvgRootNode`.

```ts
import { parseSvg } from "svg-ast-kit";

const root = parseSvg(`<svg><title>Logo</title></svg>`, {
  includePositions: true
});
```

The tree shape is intentionally JSON-friendly:

```ts
type SvgRootNode = {
  type: "root";
  children: SvgNode[];
};

type SvgElementNode = {
  type: "element";
  name: string;
  attributes: Record<string, string>;
  children: SvgNode[];
  selfClosing: boolean;
};
```

Supported node types:

| Type | Example |
| --- | --- |
| `element` | `<path d="M0 0" />` |
| `text` | `<title>Logo</title>` |
| `comment` | `<!-- note -->` |
| `cdata` | `<![CDATA[a > b]]>` |
| `instruction` | `<?xml version="1.0"?>` |
| `doctype` | `<!DOCTYPE svg>` |

Options:

| Option | Default | Description |
| --- | --- | --- |
| `includeComments` | `true` | Keep comment nodes. |
| `includeInstructions` | `true` | Keep processing instructions. |
| `includeDoctype` | `true` | Keep doctype declarations. |
| `includeWhitespaceText` | `false` | Keep whitespace-only text nodes. |
| `decodeEntities` | `true` | Decode common XML entities. |
| `includePositions` | `false` | Attach offset, line and column metadata. |

### `tryParseSvg(source, options?)`

Returns a result object instead of throwing. This is useful for editors, playgrounds and upload flows.

```ts
import { tryParseSvg } from "svg-ast-kit";

const result = tryParseSvg(userInput);

if (result.ok) {
  console.log(result.root);
} else {
  console.error(result.error.message);
}
```

### `svgToJson(source, options?, space?)`

Parses SVG and returns a JSON string. This is a convenience wrapper around `parseSvg`.

```ts
import { svgToJson } from "svg-ast-kit";

const json = svgToJson(`<svg><path d="M0 0" /></svg>`);
```

### `findSvgElements(root, predicate, options?)`

Finds SVG element nodes by tag name or predicate.

```ts
import { findSvgElements } from "svg-ast-kit";

findSvgElements(root, "path");
findSvgElements(root, "svg", { caseSensitive: false });
findSvgElements(root, (node) => node.attributes.id === "logo");
```

### `findFirstSvgElement(root, predicate, options?)`

Returns the first matching element, or `undefined`.

```ts
import { findFirstSvgElement } from "svg-ast-kit";

const logo = findFirstSvgElement(root, (node) => node.attributes.id === "logo");
```

### `getSvgRootElement(root)`

Returns the first `<svg>` element in the tree. The lookup is case-insensitive because snippets copied from tools are not always normalized.

```ts
import { getSvgRootElement } from "svg-ast-kit";

const svg = getSvgRootElement(root);
```

### `walkSvg(root, visitor)`

Walks the tree depth-first. Return `false` to skip a node's children.

```ts
import { walkSvg } from "svg-ast-kit";

walkSvg(root, ({ node, depth }) => {
  if (node.type === "element") {
    console.log(depth, node.name);
  }
});
```

### `getSvgStats(root)`

Returns basic inventory data for demos, audits and tooling.

```ts
import { getSvgStats } from "svg-ast-kit";

getSvgStats(root);
```

Result:

```ts
type SvgStats = {
  elements: number;
  attributes: number;
  textNodes: number;
  comments: number;
  cdata: number;
  instructions: number;
  doctypes: number;
  maxDepth: number;
  elementsByName: Record<string, number>;
};
```

## Errors

Invalid markup throws `SvgParseError`, which includes `offset`, `line` and `column`.

```ts
import { SvgParseError, parseSvg } from "svg-ast-kit";

try {
  parseSvg("<svg><g></svg>");
} catch (error) {
  if (error instanceof SvgParseError) {
    console.log(error.message);
    console.log(error.line, error.column);
  }
}
```

## Notes

- This package is for SVG/XML-like tooling, not for HTML parsing.
- Attribute values must be quoted.
- SVG fragments are allowed; a document does not have to contain exactly one root element.
- `findSvgElements()` is case-sensitive by default. Use `{ caseSensitive: false }` for loose inspection.
- The parser does not execute scripts, load external resources or render SVG.
- The implementation is clean-room and does not copy code from the existing `svg-parser` package.

## License

MPL-2.0
