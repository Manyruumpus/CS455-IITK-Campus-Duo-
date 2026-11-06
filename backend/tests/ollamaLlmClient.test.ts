import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
  OllamaLlmClient,
  createOllamaLlmClient,
} from '../src/services/ollamaLlmClient';
import { getLlmConfig } from '../src/config/env';
import { LlmExplanationRequest } from '../src/services/agentService';

const request: LlmExplanationRequest = {
  userPrompt: 'Need peer for quiet afternoon problem solving',
  candidates: [
    {
      userId: '00000000-0000-0000-0000-00000000d502',
      displayName: 'Sam Tandon',
      score: 87,
      groundedFacts: ['Shared courses: CS455', 'Preferred study pace: STANDARD_REGULAR'],
    },
  ],
};

function ollamaResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      model: 'qwen2.5vl:3b',
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content },
      done: true,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('OllamaLlmClient unit & configuration suite', () => {
  it('correctly configures Ollama provider from environment', () => {
    const config = getLlmConfig({
      ENABLE_LLM_INFERENCE: 'true',
      LLM_PROVIDER: 'ollama',
      OLLAMA_MODEL: 'qwen2.5vl:3b',
      OLLAMA_HOST: 'http://localhost:11434',
    });

    expect(config.enabled).toBe(true);
    expect(config.provider).toBe('ollama');
    expect(config.modelId).toBe('qwen2.5vl:3b');
    expect(config.ollamaHost).toBe('http://localhost:11434');
    expect(config.configurationIssue).toBeUndefined();

    const client = createOllamaLlmClient(config);
    expect(client).toBeInstanceOf(OllamaLlmClient);
  });

  it('preserves Hugging Face provider when LLM_PROVIDER is not ollama', () => {
    const config = getLlmConfig({
      ENABLE_LLM_INFERENCE: 'true',
      LLM_PROVIDER: 'huggingface',
      HF_TOKEN: 'hf_test_sentinel',
    });

    expect(config.provider).toBe('huggingface');
    expect(createOllamaLlmClient(config)).toBeUndefined();
  });

  it('rejects invalid OLLAMA_HOST without http/https schema', () => {
    const config = getLlmConfig({
      ENABLE_LLM_INFERENCE: 'true',
      LLM_PROVIDER: 'ollama',
      OLLAMA_HOST: 'localhost:11434',
    });

    expect(config.configurationIssue).toBe('OLLAMA_HOST must be a valid HTTP or HTTPS URL.');
    expect(createOllamaLlmClient(config)).toBeUndefined();
  });

  it('targets POST /api/chat with format json and propagates prompt without leaking private candidate identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      ollamaResponse(
        JSON.stringify([
          {
            candidateId: 'candidate_1',
            explanation: 'Score 87 with shared courses CS455 and study pace STANDARD_REGULAR.',
          },
        ])
      )
    ) as unknown as typeof fetch;

    const client = new OllamaLlmClient(
      DEFAULT_OLLAMA_HOST,
      DEFAULT_OLLAMA_MODEL,
      5000,
      fetchMock
    );

    const result = await client.generateExplanations(request);

    expect(result).toEqual([
      {
        userId: '00000000-0000-0000-0000-00000000d502',
        explanation: 'Score 87 with shared courses CS455 and study pace STANDARD_REGULAR.',
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as any).mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('qwen2.5vl:3b');
    expect(body.stream).toBe(false);
    expect(body.format).toBe('json');
    expect(body.messages[0].role).toBe('system');

    // Prompt propagation verified
    expect(body.messages[1].content).toContain('Need peer for quiet afternoon problem solving');
    expect(body.messages[1].content).toContain('candidate_1');

    // Identity isolation verified
    const serializedBody = JSON.stringify(body);
    expect(serializedBody).not.toContain('00000000-0000-0000-0000-00000000d502');
    expect(serializedBody).not.toContain('Sam Tandon');
  });

  it('handles markdown code block wrapped JSON ({ candidates: [...] } or array)', async () => {
    const wrappedContent = '```json\n{"candidates":[{"candidateId":"candidate_1","explanation":"Matches study pace."}]}\n```';
    const fetchMock = vi.fn().mockResolvedValue(ollamaResponse(wrappedContent)) as unknown as typeof fetch;
    const client = new OllamaLlmClient(DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL, 5000, fetchMock);

    const result = await client.generateExplanations(request);
    expect(result).toEqual([
      {
        userId: '00000000-0000-0000-0000-00000000d502',
        explanation: 'Matches study pace.',
      },
    ]);
  });

  it('handles candidateId-keyed JSON map responses', async () => {
    const mapContent = JSON.stringify({
      candidate_1: { explanation: 'Shared courses CS455.' },
    });
    const fetchMock = vi.fn().mockResolvedValue(ollamaResponse(mapContent)) as unknown as typeof fetch;
    const client = new OllamaLlmClient(DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL, 5000, fetchMock);

    const result = await client.generateExplanations(request);
    expect(result).toEqual([
      {
        userId: '00000000-0000-0000-0000-00000000d502',
        explanation: 'Shared courses CS455.',
      },
    ]);
  });

  it('returns empty array immediately when candidate list is empty without contacting server', async () => {
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const client = new OllamaLlmClient(DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL, 5000, fetchMock);

    const result = await client.generateExplanations({
      userPrompt: 'some prompt',
      candidates: [],
    });

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP 500 server error', new Response('Internal error', { status: 500 })],
    ['HTTP 404 not found', new Response('Model not found', { status: 404 })],
    ['Ollama error body', new Response(JSON.stringify({ error: 'model not loaded' }), { status: 200 })],
    ['non-JSON content', ollamaResponse('plain text not json')],
    ['empty content', ollamaResponse('')],
    ['unrelated candidate id', ollamaResponse(JSON.stringify([{ candidateId: 'candidate_99', explanation: 'wrong' }]))],
  ])('throws sanitized error on %s for fallback triggering', async (_name, response) => {
    const fetchMock = vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
    const client = new OllamaLlmClient(DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL, 5000, fetchMock);

    await expect(client.generateExplanations(request)).rejects.toThrow(
      'Ollama inference request failed.'
    );
  });

  it('handles server network failure and timeout gracefully', async () => {
    const networkFail = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    const client = new OllamaLlmClient(DEFAULT_OLLAMA_HOST, DEFAULT_OLLAMA_MODEL, 5000, networkFail);

    await expect(client.generateExplanations(request)).rejects.toThrow(
      'Ollama inference request failed.'
    );
  });
});
