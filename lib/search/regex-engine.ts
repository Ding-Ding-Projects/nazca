import { RE2 } from 're2-wasm';

export type RegexEvaluationRequest = {
  requestId: number;
  pattern: string;
  flags: string;
  values: string[];
  replacement: string;
  maxMatches?: number;
};

export type RegexHit = {
  valueIndex: number;
  match: string;
  index: number;
  captures: Array<string | null>;
};

export type RegexEvaluationResult = {
  requestId: number;
  valid: boolean;
  flags: string;
  error: string | null;
  unsupported: string | null;
  hits: RegexHit[];
  matchedValueIndexes: number[];
  replacementPreview: string | null;
  durationMs: number;
  truncated: boolean;
};

const MAX_PATTERN = 256;
const MAX_VALUE = 8192;
const MAX_TOTAL_VALUE_BYTES = 2 * 1024 * 1024;
const ALLOWED_FLAGS = new Set(['g', 'i', 'm', 's', 'u', 'y']);

export function normalizeRegexFlags(input: string) {
  const normalized = [...new Set(`${input}u`.split(''))].join('');
  for (const flag of normalized) {
    if (!ALLOWED_FLAGS.has(flag)) throw new Error(`Unsupported flag: ${flag}`);
  }
  return normalized.includes('g') ? normalized : `g${normalized}`;
}

function nextCodePointIndex(value: string, index: number) {
  if (index >= value.length) return value.length + 1;
  const codePoint = value.codePointAt(index);
  return index + (codePoint !== undefined && codePoint > 0xffff ? 2 : 1);
}

export function evaluateRegex(
  request: RegexEvaluationRequest,
): RegexEvaluationResult {
  const started = performance.now();
  const base = {
    requestId: request.requestId,
    hits: [] as RegexHit[],
    matchedValueIndexes: [] as number[],
    replacementPreview: null as string | null,
    truncated: false,
  };
  if (request.pattern.length > MAX_PATTERN) {
    return {
      ...base,
      valid: false,
      flags: request.flags,
      error: `Pattern exceeds ${MAX_PATTERN} characters.`,
      unsupported: null,
      durationMs: performance.now() - started,
    };
  }
  const values = request.values.map((value) => value.slice(0, MAX_VALUE));
  const totalBytes = values.reduce(
    (total, value) => total + new TextEncoder().encode(value).length,
    0,
  );
  if (totalBytes > MAX_TOTAL_VALUE_BYTES) {
    return {
      ...base,
      valid: false,
      flags: request.flags,
      error: 'Search samples exceed the 2 MiB evaluation limit.',
      unsupported: null,
      durationMs: performance.now() - started,
    };
  }
  let flags: string;
  let expression: RE2;
  try {
    flags = normalizeRegexFlags(request.flags);
    expression = new RE2(request.pattern, flags);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The pattern is invalid.';
    const unsupported =
      /invalid perl operator|invalid escape sequence|backreference/i.test(
        message,
      )
        ? 'RE2 does not support lookaround or backreferences because they require backtracking behavior.'
        : null;
    return {
      ...base,
      valid: false,
      flags: request.flags,
      error: message,
      unsupported,
      durationMs: performance.now() - started,
    };
  }

  const maxMatches = Math.min(Math.max(request.maxMatches ?? 1000, 1), 1000);
  const matched = new Set<number>();
  for (const [valueIndex, value] of values.entries()) {
    expression.lastIndex = 0;
    while (base.hits.length < maxMatches) {
      const result = expression.exec(value);
      if (!result) break;
      matched.add(valueIndex);
      base.hits.push({
        valueIndex,
        match: result[0] ?? '',
        index: result.index,
        captures: result.slice(1).map((capture) => capture ?? null),
      });
      if ((result[0] ?? '').length === 0) {
        expression.lastIndex = nextCodePointIndex(value, expression.lastIndex);
      }
    }
    if (base.hits.length >= maxMatches) {
      base.truncated = true;
      break;
    }
  }
  base.matchedValueIndexes = [...matched];
  if (values[0] !== undefined) {
    if (base.hits.some((hit) => hit.match.length === 0)) {
      base.replacementPreview =
        'Replacement preview is intentionally unavailable for zero-width matches.';
    } else {
      expression.lastIndex = 0;
      base.replacementPreview = expression.replace(
        values[0],
        request.replacement,
      );
    }
  }
  return {
    ...base,
    valid: true,
    flags,
    error: null,
    unsupported: null,
    durationMs: performance.now() - started,
  };
}
