import {
  workoutCoachingEvaluationSchema,
  type WorkoutCoachClient,
  type WorkoutCoachInput,
  type WorkoutCoachingEvaluation
} from './coaching.types.js';

const COACHING_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    positives: { type: 'array', items: { type: 'string' } },
    watchouts: { type: 'array', items: { type: 'string' } },
    nextWorkoutFocus: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    safetyNote: { type: ['string', 'null'] }
  },
  required: [
    'headline',
    'summary',
    'positives',
    'watchouts',
    'nextWorkoutFocus',
    'confidence',
    'safetyNote'
  ]
} as const;

type ResponsesApiPayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

export function extractResponseOutputText(payload: ResponsesApiPayload): string {
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
      if (content.type === 'refusal' && typeof content.refusal === 'string') {
        throw new Error(`OpenAI coaching request was refused: ${content.refusal}`);
      }
    }
  }

  throw new Error('OpenAI coaching response did not contain structured output text');
}

export class OpenAIWorkoutCoachClient implements WorkoutCoachClient {
  readonly enabled: boolean;

  constructor(
    private readonly apiKey: string | undefined,
    readonly model = 'gpt-5.6-luna',
    private readonly timeoutMs = 20_000
  ) {
    this.enabled = Boolean(apiKey?.trim());
  }

  async evaluate(input: WorkoutCoachInput): Promise<WorkoutCoachingEvaluation> {
    if (!this.apiKey?.trim()) {
      throw new Error('OpenAI coaching is disabled because OPENAI_API_KEY is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [
          {
            role: 'developer',
            content: [
              {
                type: 'input_text',
                text: [
                  'You are the coaching interpretation layer for a fitness tracker.',
                  'Treat every numeric metric supplied by the backend as authoritative.',
                  'Do not recalculate, infer missing measurements, or invent personal records.',
                  'Explain what the calculated workout and trend metrics suggest in concise, practical language.',
                  'Do not diagnose medical conditions. If the supplied metrics are insufficient or concerning, lower confidence and recommend appropriate caution rather than making a diagnosis.',
                  'Keep advice proportional to the evidence and suitable for the next workout.'
                ].join(' ')
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(input)
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'workout_coaching',
            strict: true,
            schema: COACHING_OUTPUT_SCHEMA
          }
        }
      })
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 1000);
      throw new Error(`OpenAI coaching request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as ResponsesApiPayload;
    const outputText = extractResponseOutputText(payload);
    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new Error('OpenAI coaching response was not valid JSON');
    }

    return workoutCoachingEvaluationSchema.parse(parsed);
  }
}
