import { IModerationService, ServiceContext } from '@/services/interfaces';
import { AppError, ErrorCode, ReportReceipt } from '@/types';

export class HttpModerationAdapter implements IModerationService {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: { baseUrl?: string; fetchFn?: typeof fetch }) {
    this.baseUrl = (
      options?.baseUrl ??
      import.meta.env.VITE_API_URL ??
      import.meta.env.VITE_API_BASE_URL ??
      'http://localhost:4000'
    ).replace(/\/+$/, '');
    this.fetchFn =
      options?.fetchFn ??
      (typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch);
  }

  private async request<T>(path: string, init: RequestInit, context: ServiceContext): Promise<T> {
    const token = context.actorSession?.sessionToken;
    if (!token) throw new AppError(ErrorCode.UNAUTHENTICATED, 'A valid authenticated session is required.');
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
      signal: context.signal,
    });
    const body = await response.json().catch(() => undefined);
    if (!response.ok) {
      throw new AppError(
        body?.error?.code ?? (response.status === 403 ? ErrorCode.FORBIDDEN : ErrorCode.SERVICE_UNAVAILABLE),
        body?.error?.message ?? 'Moderation request failed.'
      );
    }
    return body?.data as T;
  }

  async reportUser(
    reportedUserId: string,
    category: string,
    description: string | undefined,
    context: ServiceContext
  ): Promise<ReportReceipt> {
    return this.request('/api/moderation/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportedUserId, category, description }),
    }, context);
  }

  async blockUser(targetUserId: string, context: ServiceContext): Promise<{ blocked: boolean }> {
    return this.request(`/api/moderation/blocks/${encodeURIComponent(targetUserId)}`, {
      method: 'POST',
    }, context);
  }

  async unblockUser(targetUserId: string, context: ServiceContext): Promise<{ blocked: boolean }> {
    return this.request(`/api/moderation/blocks/${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
    }, context);
  }

  async listBlockedUsers(context: ServiceContext): Promise<string[]> {
    return this.request('/api/moderation/blocks', { method: 'GET' }, context);
  }

  async listMyReports(context: ServiceContext): Promise<ReportReceipt[]> {
    return this.request('/api/moderation/reports/mine', { method: 'GET' }, context);
  }
}
