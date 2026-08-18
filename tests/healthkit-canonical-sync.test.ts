import { describe, expect, it } from 'vitest';
import { appleHealthImportSchema } from '../src/integrations/apple-health/apple-health.schema.js';
import { extractResponseOutputText } from '../src/modules/coaching/openai-coach.client.js';
import { workoutCoachingEvaluationSchema } from '../src/modules/coaching/coaching.types.js';

describe('HealthKit canonical sync contract', () => {
  it('defaults deleted workout IDs for older clients', () => {
    const parsed = appleHealthImportSchema.parse({
      syncId: 'healthkit-sync-001',
      exportedAt: '2026-08-18T20:00:00Z',
      weights: [],
      workouts: []
    });

    expect(parsed.deletedWorkoutSourceRecordIds).toEqual([]);
  });

  it('accepts HealthKit workout deletions', () => {
    const parsed = appleHealthImportSchema.parse({
      syncId: 'healthkit-sync-002',
      exportedAt: '2026-08-18T20:00:00Z',
      weights: [],
      workouts: [],
      deletedWorkoutSourceRecordIds: ['healthkit-workout-uuid']
    });

    expect(parsed.deletedWorkoutSourceRecordIds).toEqual(['healthkit-workout-uuid']);
  });
});

describe('OpenAI coaching response parsing', () => {
  it('extracts structured output text and validates the coaching shape', () => {
    const output = JSON.stringify({
      headline: 'Efficient aerobic run',
      summary: 'Your calculated pace-to-heart-rate efficiency improved.',
      positives: ['Lower heart rate at comparable pace'],
      watchouts: [],
      nextWorkoutFocus: ['Keep the next easy run controlled'],
      confidence: 'high',
      safetyNote: null
    });

    const extracted = extractResponseOutputText({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: output }]
        }
      ]
    });

    expect(workoutCoachingEvaluationSchema.parse(JSON.parse(extracted)).confidence).toBe('high');
  });

  it('rejects refusal content rather than treating it as coaching JSON', () => {
    expect(() =>
      extractResponseOutputText({
        output: [
          {
            content: [{ type: 'refusal', refusal: 'Cannot provide this response.' }]
          }
        ]
      })
    ).toThrow(/refused/i);
  });
});
