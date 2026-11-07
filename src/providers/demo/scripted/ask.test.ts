import { describe, it, expect } from 'vitest';
import { matchScripted, SCRIPTED_ASKS } from './ask.ts';
import { SUGGESTED_QUESTIONS } from '@plans/suggestedQuestions.ts';

describe('matchScripted', () => {
  it('matches the afternoon question loosely', () => {
    expect(matchScripted('what if afternoon classes go online and we add a bus')?.id).toBe('afternoon-online-one-bus');
  });
  it('returns null when nothing matches', () => {
    expect(matchScripted('tell me a joke')).toBeNull();
  });
  it('matches Friday prayers', () => {
    expect(matchScripted('Friday prayers smoothing')?.id).toBe('friday-smooth');
  });
  it('keeps suggested questions in table order', () => {
    expect(SCRIPTED_ASKS.map(a => a.question)).toEqual([...SUGGESTED_QUESTIONS]);
  });
});
