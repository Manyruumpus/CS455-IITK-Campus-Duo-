import {
  DEFAULT_HF_MODEL_ID,
  LlmConfig,
} from '../config/env';
import type {
  ILlmClient,
  LlmCandidateExplanation,
  LlmExplanationRequest,
} from './agentService';

export const HF_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions';

interface HuggingFaceChatCompletionResponse {
  choices?: Array<{
    message?: { content?: unknown };
  }>;
}

/** Hugging Face hosted inference adapter; never sends candidate identifiers or names. */
export class HuggingFaceLlmClient implements ILlmClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly token: string,
    private readonly modelId: string = DEFAULT_HF_MODEL_ID,
    private readonly timeoutMs: number = 20_000,
    fetchImpl: typeof fetch = fetch
  ) {
    this.fetchImpl = fetchImpl;
  }

  async generateExplanations(
    req: LlmExplanationRequest
  ): Promise<LlmCandidateExplanation[]> {
    if (!this.token.trim() || !this.modelId.trim()) {
      throw new Error('Hugging Face inference is not configured.');
    }
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
      const response = await this.fetchImpl(HF_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [
            {
              role: 'system',
              content:
                'Write one brief explanation per candidate using only the supplied score and grounded facts. If a userPrompt is provided, focus on relevant grounded facts that match it. Return only a JSON array of objects with candidateId and explanation fields. Do not infer eligibility or take actions.',
            },
            {
              role: 'user',
              content: userMessageContent,
            },
          ],
          temperature: 0.2,
          max_tokens: 2048,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Hugging Face inference request failed.');
      }

      const body = (await response.json()) as HuggingFaceChatCompletionResponse;
      const rawContent = body.choices?.[0]?.message?.content;
      if (typeof rawContent !== 'string' || !rawContent.trim()) {
        throw new Error('Hugging Face inference returned no content.');
      }

      let content = rawContent.trim();
      const codeBlockMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content);
      if (codeBlockMatch) {
        content = codeBlockMatch[1].trim();
      }

      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed) || parsed.length !== req.candidates.length) {
        throw new Error('Hugging Face inference returned malformed content.');
      }

      const explanations: LlmCandidateExplanation[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        if (
          !item ||
          typeof item !== 'object' ||
          !('candidateId' in item) ||
          !('explanation' in item) ||
          typeof item.candidateId !== 'string' ||
          typeof item.explanation !== 'string' ||
          !item.explanation.trim() ||
          item.explanation.length > 500
        ) {
          throw new Error('Hugging Face inference returned malformed content.');
        }

        const match = /^candidate_(\d+)$/.exec(item.candidateId);
        const candidateIndex = match ? Number(match[1]) - 1 : -1;
        const candidate = req.candidates[candidateIndex];
        if (!candidate || seen.has(item.candidateId)) {
          throw new Error('Hugging Face inference returned malformed content.');
        }
        seen.add(item.candidateId);
        explanations.push({
          userId: candidate.userId,
          explanation: item.explanation.trim(),
        });
      }

      if (seen.size !== req.candidates.length) {
        throw new Error('Hugging Face inference returned malformed content.');
      }
      return explanations;
    } catch {
      // Do not propagate provider bodies, network errors, or credential-bearing URLs.
      throw new Error('Hugging Face inference request failed.');
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createHuggingFaceLlmClient(
  config: LlmConfig,
  fetchImpl?: typeof fetch
): HuggingFaceLlmClient | undefined {
  if (!config.enabled || config.configurationIssue || !config.token) {
    return undefined;
  }
  return new HuggingFaceLlmClient(
    config.token,
    config.modelId,
    config.timeoutMs,
    fetchImpl
  );
}
