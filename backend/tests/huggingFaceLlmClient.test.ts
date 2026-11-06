import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_HF_MODEL_ID,
  getLlmConfig,
} from '../src/config/env';
import {
  createHuggingFaceLlmClient,
  HF_CHAT_COMPLETIONS_URL,
  HuggingFaceLlmClient,
} from '../src/services/huggingFaceLlmClient';
import { LlmExplanationRequest } from '../src/services/agentService';

const SENTINEL_TOKEN = 'hf_test_token_must_never_leak';
const request: LlmExplanationRequest = {
  userPrompt: 'Need peer for quiet afternoon study',
  candidates: [
    {
      userId: 'private-candidate-id',
      displayName: 'Private Candidate Name',
      score: 82,
      groundedFacts: ['Shared courses: CS455', 'Overlapping study availability'],
    },
  ],
};

function completion(content: string): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('Hugging Face inference configuration', () => {
  it('keeps inference disabled by default and uses the approved model default', () => {
    const config = getLlmConfig({});

    expect(config.enabled).toBe(false);
    expect(config.modelId).toBe(DEFAULT_HF_MODEL_ID);
    expect(config.timeoutMs).toBe(20_000);
    expect(createHuggingFaceLlmClient(config)).toBeUndefined();
  });

  it('does not construct an inference client when enabled without a token', () => {
    const config = getLlmConfig({ ENABLE_LLM_INFERENCE: 'true' });

    expect(config.configurationIssue).toBe(
      'Inference is enabled but HF_TOKEN is missing.'
    );
    expect(createHuggingFaceLlmClient(config)).toBeUndefined();
  });

  it('rejects malformed model and timeout configuration without exposing values', () => {
    const invalidModel = getLlmConfig({
      ENABLE_LLM_INFERENCE: 'true',
      HF_TOKEN: SENTINEL_TOKEN,
      HF_MODEL_ID: 'https://invalid.example/token-value',
    });
    const invalidTimeout = getLlmConfig({
      ENABLE_LLM_INFERENCE: 'true',
      HF_TOKEN: SENTINEL_TOKEN,
      HF_TIMEOUT_MS: 'not-a-number',
    });

    expect(invalidModel.configurationIssue).toBe('HF_MODEL_ID is invalid.');
    expect(invalidTimeout.configurationIssue).toBe(
      'HF_TIMEOUT_MS must be between 1000 and 30000.'
    );
    expect(JSON.stringify([invalidModel.configurationIssue, invalidTimeout.configurationIssue]))
      .not.toContain(SENTINEL_TOKEN);
    expect(createHuggingFaceLlmClient(invalidModel)).toBeUndefined();
    expect(createHuggingFaceLlmClient(invalidTimeout)).toBeUndefined();
  });

  it('creates the configured Hugging Face client and honors supported overrides', () => {
    const config = getLlmConfig({
      ENABLE_LLM_INFERENCE: 'true',
      HF_TOKEN: SENTINEL_TOKEN,
      HF_MODEL_ID: 'Qwen/Qwen3-4B-Instruct-2507',
      HF_TIMEOUT_MS: '12000',
    });

    expect(config.configurationIssue).toBeUndefined();
    expect(config.modelId).toBe(DEFAULT_HF_MODEL_ID);
    expect(config.timeoutMs).toBe(12_000);
    expect(createHuggingFaceLlmClient(config)).toBeInstanceOf(HuggingFaceLlmClient);
  });
});

describe('HuggingFaceLlmClient', () => {
  it('uses the official endpoint and maps a valid response without disclosing candidate identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completion(
        JSON.stringify([
          {
            candidateId: 'candidate_1',
            explanation: 'Strong shared courses and overlapping study availability.',
          },
        ])
      )
    ) as unknown as typeof fetch;
    const client = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5000,
      fetchMock
    );

    await expect(client.generateExplanations(request)).resolves.toEqual([
      {
        userId: 'private-candidate-id',
        explanation: 'Strong shared courses and overlapping study availability.',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as any).mock.calls[0];
    expect(url).toBe(HF_CHAT_COMPLETIONS_URL);
    expect(init.headers).toEqual({
      Authorization: `Bearer ${SENTINEL_TOKEN}`,
      'Content-Type': 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const payload = JSON.parse(init.body);
    expect(payload).toMatchObject({
      model: DEFAULT_HF_MODEL_ID,
      temperature: 0.2,
      max_tokens: 2048,
      stream: false,
    });
    expect(payload.messages[0].role).toBe('system');
    expect(payload.messages[1].content).toContain('candidate_1');
    expect(payload.messages[1].content).toContain('Overlapping study availability');
    expect(payload.messages[1].content).toContain('Need peer for quiet afternoon study');
    expect(JSON.stringify(payload)).not.toContain('private-candidate-id');
    expect(JSON.stringify(payload)).not.toContain('Private Candidate Name');
  });

  it.each([401, 402, 404, 429, 500, 503])(
    'sanitizes HTTP %i provider failures',
    async (status) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(`provider detail ${SENTINEL_TOKEN}`, { status })
      ) as unknown as typeof fetch;
      const client = new HuggingFaceLlmClient(
        SENTINEL_TOKEN,
        DEFAULT_HF_MODEL_ID,
        5000,
        fetchMock
      );

      let thrown: unknown;
      try {
        await client.generateExplanations(request);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe(
        'Hugging Face inference request failed.'
      );
      expect((thrown as Error).message).not.toContain(SENTINEL_TOKEN);
      expect((thrown as Error).message).not.toContain('provider detail');
    }
  );

  it('sanitizes network errors and timeout failures', async () => {
    const networkFetch = vi.fn().mockRejectedValue(
      new Error(`network detail ${SENTINEL_TOKEN}`)
    ) as unknown as typeof fetch;
    const networkClient = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5000,
      networkFetch
    );
    await expect(networkClient.generateExplanations(request)).rejects.toThrow(
      'Hugging Face inference request failed.'
    );

    const timeoutFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error(`aborted ${SENTINEL_TOKEN}`))
          );
        })
    ) as unknown as typeof fetch;
    const timeoutClient = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5,
      timeoutFetch
    );
    await expect(timeoutClient.generateExplanations(request)).rejects.toThrow(
      'Hugging Face inference request failed.'
    );
  });

  it('does not write credentials or provider error details to captured logs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValue(
      new Error(`provider failure ${SENTINEL_TOKEN}`)
    ) as unknown as typeof fetch;

    try {
      await expect(
        new HuggingFaceLlmClient(
          SENTINEL_TOKEN,
          DEFAULT_HF_MODEL_ID,
          5000,
          fetchMock
        ).generateExplanations(request)
      ).rejects.toThrow('Hugging Face inference request failed.');

      const capturedLogs = JSON.stringify([
        warnSpy.mock.calls,
        errorSpy.mock.calls,
      ]);
      expect(capturedLogs).not.toContain(SENTINEL_TOKEN);
      expect(capturedLogs).not.toContain('provider failure');
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it.each([
    ['invalid response JSON', new Response('not json', { status: 200 })],
    ['empty response content', completion('')],
    ['empty explanations', completion('[]')],
    ['malformed explanation data', completion('[{"candidateId":"candidate_1","explanation":""}]')],
    ['unknown candidate label', completion('[{"candidateId":"candidate_2","explanation":"shared courses"}]')],
  ])('rejects %s for deterministic fallback', async (_name, response) => {
    const fetchMock = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
    const client = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5000,
      fetchMock
    );

    await expect(client.generateExplanations(request)).rejects.toThrow(
      'Hugging Face inference request failed.'
    );
  });

  it('returns an empty array immediately when candidates list is empty', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const client = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5000,
      fetchMock
    );

    const result = await client.generateExplanations({
      userPrompt: 'irrelevant prompt',
      candidates: [],
    });

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('successfully parses markdown code-fenced JSON responses from the provider', async () => {
    const markdownContent = '```json\n[{"candidateId":"candidate_1","explanation":"Matches study pace and shared courses."}]\n```';
    const fetchMock = vi.fn().mockResolvedValue(completion(markdownContent)) as unknown as typeof fetch;
    const client = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5000,
      fetchMock
    );

    const result = await client.generateExplanations(request);
    expect(result).toEqual([
      {
        userId: 'private-candidate-id',
        explanation: 'Matches study pace and shared courses.',
      },
    ]);
  });

  it('omits userPrompt from message payload when userPrompt is undefined or whitespace', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completion(
        JSON.stringify([
          {
            candidateId: 'candidate_1',
            explanation: 'Grounded match.',
          },
        ])
      )
    ) as unknown as typeof fetch;
    const client = new HuggingFaceLlmClient(
      SENTINEL_TOKEN,
      DEFAULT_HF_MODEL_ID,
      5000,
      fetchMock
    );

    await client.generateExplanations({
      userPrompt: '   ',
      candidates: request.candidates,
    });

    const [, init] = (fetchMock as any).mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload.messages[1].content).not.toContain('userPrompt');
  });
});
