// Minimal JSON-schema validator: only the subset the AI functions use.
export type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  anyOf?: JsonSchema[];
  description?: string;
};

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function matchesType(t: string, v: unknown): boolean {
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === t;
}

export function validateJson(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const errors: string[] = [];

  if (schema.anyOf && !schema.anyOf.some((s) => validateJson(s, value, path).length === 0)) {
    errors.push(`${path}: matches none of anyOf`);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(t, value))) {
      errors.push(`${path}: expected ${types.join(' | ')}`);
      return errors;
    }
  }

  if (schema.enum && !schema.enum.some((e) => e === value)) errors.push(`${path}: not in enum`);

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum`);
  }

  if (typeof value === 'string' && schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push(`${path}: too long`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: too many items`);
    const items = schema.items;
    if (items) value.forEach((v, i) => errors.push(...validateJson(items, v, `${path}[${i}]`)));
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) errors.push(`${path}.${key}: required`);
    }
    const props = schema.properties ?? {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in obj) errors.push(...validateJson(sub, obj[key], `${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in props)) errors.push(`${path}.${key}: unexpected property`);
      }
    }
  }

  return errors;
}
