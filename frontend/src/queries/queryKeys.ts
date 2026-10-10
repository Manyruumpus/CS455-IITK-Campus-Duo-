/**
 * Actor-scoped TanStack Query key factories.
 * Every permission-sensitive query key embeds the actorId to ensure
 * absolute cache isolation across session changes.
 */

import { ConnectionMode } from '@/types';

export const queryKeys = {
  bookings: {
    all: (actorId: string) => ['bookings', actorId] as const,
    availability: (actorId: string, locationId: string, date: string) =>
      ['bookings', actorId, 'availability', locationId, date] as const,
    myBookings: (actorId: string, status?: string) =>
      ['bookings', actorId, 'my', { status: status ?? 'all' }] as const,
    detail: (actorId: string, bookingId: string) =>
      ['bookings', actorId, 'detail', bookingId] as const,
  },
  profiles: {
    all: (actorId: string) => ['profiles', actorId] as const,
    me: (actorId: string) => ['profiles', actorId, 'me'] as const,
    public: (actorId: string, targetUserId: string) =>
      ['profiles', actorId, 'public', targetUserId] as const,
    studyPreview: (actorId: string) => ['profiles', actorId, 'preview', 'study'] as const,
    socialPreview: (actorId: string) => ['profiles', actorId, 'preview', 'social'] as const,
  },
  consent: {
    all: (actorId: string) => ['consent', actorId] as const,
    study: (actorId: string) => ['consent', actorId, 'study'] as const,
    social: (actorId: string) => ['consent', actorId, 'social'] as const,
  },
  study: {
    all: (actorId: string) => ['study', actorId] as const,
    recommendations: (actorId: string, filters?: Record<string, unknown>) =>
      ['study', actorId, 'recommendations', filters ?? {}] as const,
    detail: (actorId: string, studentId: string) =>
      ['study', actorId, 'detail', studentId] as const,
    matchingQuery: (actorId: string, queryId: string) =>
      ['study', actorId, 'query', queryId] as const,
  },
  social: {
    all: (actorId: string) => ['social', actorId] as const,
    discover: (actorId: string, filters?: Record<string, unknown>) =>
      ['social', actorId, 'discover', filters ?? {}] as const,
    detail: (actorId: string, targetUserId: string) =>
      ['social', actorId, 'detail', targetUserId] as const,
    connections: (actorId: string) => ['social', actorId, 'connections'] as const,
  },
  connections: {
    all: (actorId: string) => ['connections', actorId] as const,
    list: (actorId: string, mode: ConnectionMode) =>
      ['connections', actorId, 'list', mode] as const,
    summaries: (actorId: string, mode: ConnectionMode, bucket: 'ALL' | 'OUTGOING' | 'INCOMING' | 'MUTUAL') =>
      ['connections', actorId, 'summaries', mode, bucket] as const,
    counts: (actorId: string, mode: ConnectionMode) =>
      ['connections', actorId, 'counts', mode] as const,
    detail: (actorId: string, connectionId: string) =>
      ['connections', actorId, 'detail', connectionId] as const,
  },
  moderation: {
    all: (actorId: string) => ['moderation', actorId] as const,
    blocked: (actorId: string) => ['moderation', actorId, 'blocked'] as const,
  },
  notifications: {
    all: (actorId: string) => ['notifications', actorId] as const,
    list: (actorId: string, filters?: Record<string, unknown>) =>
      ['notifications', actorId, 'list', filters ?? {}] as const,
    unread: (actorId: string) => ['notifications', actorId, 'unread'] as const,
  },
  admin: {
    all: (actorId: string) => ['admin', actorId] as const,
    dashboard: (actorId: string) => ['admin', actorId, 'dashboard'] as const,
    users: (actorId: string, search?: string) => ['admin', actorId, 'users', search ?? ''] as const,
    user: (actorId: string, userId: string) => ['admin', actorId, 'user', userId] as const,
    resources: (actorId: string) => ['admin', actorId, 'resources'] as const,
    bookings: (actorId: string, filters?: unknown) =>
      ['admin', actorId, 'bookings', filters ?? {}] as const,
    reports: (actorId: string, status?: string) =>
      ['admin', actorId, 'reports', { status: status ?? 'all' }] as const,
    audits: (actorId: string) => ['admin', actorId, 'audits'] as const,
  },
};
