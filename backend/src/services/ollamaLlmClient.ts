import type {
  ILlmClient,
  LlmCandidateExplanation,
  LlmExplanationRequest,
} from './agentService';
import type { LlmConfig } from '../config/env';

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5vl:3b';

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: unknown;
  };
  error?: string;
}

/**
 * Ollama local inference adapter using the native POST /api/chat endpoint with stream: false.
 * Strictly avoids transmitting candidate personal identities or student names.
 */
export class OllamaLlmClient implements ILlmClient {
  private readonly host: string;
  private readonly modelId: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(
    host: string = DEFAULT_OLLAMA_HOST,
    modelId: string = DEFAULT_OLLAMA_MODEL,
    timeoutMs: number = 20_000,
    fetchImpl: typeof fetch = fetch
  ) {
    this.host = host.replace(/\/+$/, '');
    this.modelId = modelId.trim() || DEFAULT_OLLAMA_MODEL;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  async generateExplanations(
    req: LlmExplanationRequest
  ): Promise<LlmCandidateExplanation[]> {
    if (req.candidates.length === 0) return [];

    const candidateLabels = req.candidates.map((candidate, index) => ({
      candidateId: `candidate_${index + 1}`,
      score: candidate.score,
      groundedFacts: candidate.groundedFacts,
    }));

    const userMessageContent = req.userPrompt?.trim()
      ? JSON.stringify({
          userPrompt: req.userPrompt.trim(),
          candidates: candidateLabels,
        })
      : JSON.stringify(candidateLabels);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.host}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [
            {
              role: 'system',
              content:
                'Write one concise explanation per candidate using only the supplied score and grounded facts. Return only a JSON array of objects with candidateId and explanation fields. In each explanation, mention only the score and the exact grounded facts supplied without adding ungrounded claims or extraneous commentary.',
            },
            {
              role: 'user',
              content: userMessageContent,
            },
          ],
          stream: false,
          format: 'json',
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Ollama inference request failed.');
      }

      const body = (await response.json()) as OllamaChatResponse;
      if (body.error) {
        throw new Error('Ollama returned error: ' + body.error);
      }

      const rawContent = body.message?.content;
      if (typeof rawContent !== 'string' || !rawContent.trim()) {
        throw new Error('Ollama inference returned no content.');
      }

      let content = rawContent.trim();
      const codeBlockMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content);
      if (codeBlockMatch) {
        content = codeBlockMatch[1].trim();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('Ollama inference returned malformed JSON.');
      }

      // Normalize multiple JSON shapes: array, { candidates: [...] }, { explanations: [...] }, or { candidate_1: ... }
      let entries: Array<{ candidateId?: unknown; explanation?: unknown }> = [];
      if (Array.isArray(parsed)) {
        entries = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.candidates)) {
          entries = obj.candidates as Array<{ candidateId?: unknown; explanation?: unknown }>;
        } else if (Array.isArray(obj.explanations)) {
          entries = obj.explanations as Array<{ candidateId?: unknown; explanation?: unknown }>;
        } else {
          for (const [key, val] of Object.entries(obj)) {
            if (/^candidate_\d+$/i.test(key)) {
              if (typeof val === 'string') {
                entries.push({ candidateId: key, explanation: val });
              } else if (val && typeof val === 'object' && typeof (val as Record<string, unknown>).explanation === 'string') {
                entries.push({ candidateId: key, explanation: (val as Record<string, unknown>).explanation });
              }
            }
          }
        }
      }

      if (entries.length === 0) {
        throw new Error('Ollama inference returned no valid candidate explanations.');
      }

      const explanations: LlmCandidateExplanation[] = [];
      const seen = new Set<string>();

      for (const item of entries) {
        if (
          !item ||
          typeof item !== 'object' ||
          typeof item.candidateId !== 'string' ||
          typeof item.explanation !== 'string' ||
          !item.explanation.trim() ||
          item.explanation.length > 500
        ) {
          continue;
        }

        const match = /^candidate_(\d+)$/i.exec(item.candidateId);
        const candidateIndex = match ? Number(match[1]) - 1 : -1;
        const candidate = req.candidates[candidateIndex];
        if (!candidate || seen.has(item.candidateId.toLowerCase())) {
          continue;
        }

        seen.add(item.candidateId.toLowerCase());
        explanations.push({
          userId: candidate.userId,
          explanation: item.explanation.trim(),
        });
      }

      if (explanations.length !== req.candidates.length) {
        throw new Error('Ollama inference returned incomplete or mismatched explanations.');
      }

      return explanations;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Ollama inference request timed out.');
      }
      throw new Error('Ollama inference request failed.');
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createOllamaLlmClient(
  config: LlmConfig,
  fetchImpl?: typeof fetch
): OllamaLlmClient | undefined {
  if (!config.enabled || config.provider !== 'ollama' || config.configurationIssue) {
    return undefined;
  }
  return new OllamaLlmClient(
    config.ollamaHost,
    config.modelId,
    config.timeoutMs,
    fetchImpl
  );
}
