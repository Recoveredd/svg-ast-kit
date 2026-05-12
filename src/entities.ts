const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\""
};

const entityPattern = /&(#x[\da-f]+|#\d+|[a-z][\da-z]*);/giu;

export function decodeSvgEntities(value: string): string {
  return value.replace(entityPattern, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return codePointToString(Number.parseInt(entity.slice(2), 16), match);
    }

    if (entity.startsWith("#")) {
      return codePointToString(Number.parseInt(entity.slice(1), 10), match);
    }

    return namedEntities[entity] ?? match;
  });
}

function codePointToString(codePoint: number, fallback: string): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
    return fallback;
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}
