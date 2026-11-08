import { ESTIMATE_KEYS } from './engine.ts';
import type { JsonSchema } from './jsonschema.ts';

const LEVER_KINDS = [
  'classesOnline', 'stagger', 'extraBuses', 'nonstopLoop', 'busesAtLrt',
  'cafeteria', 'waitingHall', 'acOffInGap', 'advisory', 'studentCount',
];
const BLOCK_IDS = ['A', 'B', 'C', 'D', 'E', 'S', 'L', 'U'];

const minute: JsonSchema = { type: 'integer', minimum: 420, maximum: 1560 };
const confidence: JsonSchema = { type: 'string', enum: ['low', 'medium', 'high'] };
const numberOrCurve: JsonSchema = { type: ['number', 'array'], items: { type: 'number' } };

const leverFields: Record<string, JsonSchema> = {
  fromMin: minute,
  toMin: minute,
  atMin: minute,
  advisedMin: minute,
  blocks: { type: 'array', items: { type: 'string', enum: [...BLOCK_IDS, 'all'] } },
  target: { type: 'string', enum: ['end', 'start'] },
  shifts: {
    type: 'array',
    items: {
      type: 'object',
      required: ['block', 'minutes'],
      properties: {
        block: { type: 'string', enum: BLOCK_IDS },
        minutes: { type: 'number', minimum: 0, maximum: 30 },
      },
    },
  },
  buses: { type: 'integer', minimum: 1, maximum: 10 },
  outletId: { type: 'string' },
  hallId: { type: 'string' },
  extraCounters: { type: 'integer', minimum: 0, maximum: 10 },
  closeAtMin: { type: 'integer' },
  message: { type: 'string', enum: ['leave_before', 'walk_to_lrt', 'expect_delays'] },
  percent: { type: 'integer', minimum: -30, maximum: 50 },
};

/** Required and optional fields per lever kind (the P1 Lever union, in wire shape). */
const KIND_FIELDS: Record<string, { required: string[]; optional?: string[] }> = {
  classesOnline: { required: ['fromMin', 'toMin', 'blocks'] },
  stagger: { required: ['target', 'fromMin', 'toMin', 'shifts'] },
  extraBuses: { required: ['buses', 'fromMin', 'toMin'] },
  nonstopLoop: { required: ['fromMin', 'toMin'] },
  busesAtLrt: { required: ['buses', 'atMin'] },
  cafeteria: { required: ['outletId', 'extraCounters', 'fromMin', 'toMin'], optional: ['closeAtMin'] },
  waitingHall: { required: ['hallId', 'fromMin', 'toMin'] },
  acOffInGap: { required: ['fromMin', 'toMin', 'blocks'] },
  advisory: { required: ['advisedMin', 'message'] },
  studentCount: { required: ['percent'] },
};

/**
 * Levers as an object keyed by kind, each a list of that kind's levers. Gemini rejects anyOf, so this is how
 * constrained decoding gets per-kind required fields; coerceLevers flattens it back to a lever list.
 */
const leverSet: JsonSchema = {
  type: 'object',
  properties: Object.fromEntries(LEVER_KINDS.map((kind) => {
    const { required, optional = [] } = KIND_FIELDS[kind];
    return [kind, {
      type: 'array', // no maxItems: nested inside plans it makes Gemini reject the schema (400)
      items: { type: 'object', required, properties: Object.fromEntries([...required, ...optional].map((f) => [f, leverFields[f]])) },
    }];
  })),
};

export const SCHEMAS: {
  estimate: JsonSchema; ask: JsonSchema; explain: JsonSchema;
  plans: JsonSchema; announcement: JsonSchema; extract: JsonSchema;
} = {
  estimate: {
    type: 'object',
    required: ['estimates'],
    additionalProperties: false,
    properties: {
      estimates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['key', 'likely', 'low', 'high', 'unit', 'reasoning', 'confidence'],
          additionalProperties: false,
          properties: {
            key: { type: 'string', enum: ESTIMATE_KEYS.map((k) => k.key) },
            likely: numberOrCurve,
            low: numberOrCurve,
            high: numberOrCurve,
            unit: { type: 'string' },
            reasoning: { type: 'string', maxLength: 600 },
            confidence,
          },
        },
      },
    },
  },
  ask: {
    type: 'object',
    required: ['levers', 'restatement'],
    additionalProperties: false,
    properties: {
      levers: leverSet,
      restatement: { type: 'string', maxLength: 400 },
    },
  },
  explain: {
    type: 'object',
    required: ['text'],
    additionalProperties: false,
    properties: { text: { type: 'string', maxLength: 1200 } },
  },
  plans: {
    type: 'object',
    required: ['plans'],
    additionalProperties: false,
    properties: {
      plans: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['name', 'levers', 'rationale'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', maxLength: 60 },
            levers: leverSet,
            rationale: { type: 'string', maxLength: 600 },
          },
        },
      },
    },
  },
  announcement: {
    type: 'object',
    required: ['draft'],
    additionalProperties: false,
    properties: { draft: { type: 'string', maxLength: 1100 } },
  },
  extract: {
    type: 'object',
    required: ['events'],
    additionalProperties: false,
    properties: {
      events: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'venue', 'startDate', 'attendanceStated', 'isApuCalendar', 'sourceUrls', 'confidence'],
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            venue: { type: 'string' },
            venueLat: { type: 'number' },
            venueLng: { type: 'number' },
            startDate: { type: 'string', description: 'YYYY-MM-DD' },
            startTime: { type: 'string', description: 'HH:MM' },
            endDate: { type: 'string', description: 'YYYY-MM-DD' },
            endTime: { type: 'string', description: 'HH:MM' },
            expectedAttendance: { type: ['integer', 'null'] },
            attendanceStated: { type: 'boolean' },
            isApuCalendar: { type: 'boolean' },
            calendarKind: { type: 'string', enum: ['intake', 'holiday', 'break', 'other'] },
            sourceUrls: { type: 'array', items: { type: 'string' } },
            confidence,
          },
        },
      },
    },
  },
};
