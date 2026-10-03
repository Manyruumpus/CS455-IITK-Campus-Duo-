import { RouteObject, Navigate } from 'react-router-dom';

// Layouts
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ErrorLayout } from '@/components/layout/ErrorLayout';

// Guards
import { RequireAuth } from '@/app/guards/RequireAuth';
import { RequireRole } from '@/app/guards/RequireRole';
import { RequireSocialConsent } from '@/app/guards/RequireSocialConsent';

// Pages
import { LandingPage } from '@/features/marketing/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { AuthRecoveryPage } from '@/features/auth/AuthRecoveryPage';

// Student Pages
import { StudentDashboardPage } from '@/features/student/StudentDashboardPage';
import { StudyDiscoveryPage } from '@/features/student/StudyDiscoveryPage';
import { StudyDetailPage } from '@/features/student/StudyDetailPage';
import { StudyRequestsPage } from '@/features/student/StudyRequestsPage';
import { SocialDiscoveryPage } from '@/features/student/SocialDiscoveryPage';
import { SocialDetailPage } from '@/features/student/SocialDetailPage';
import { SocialConnectionsPage } from '@/features/student/SocialConnectionsPage';
import { TableBookingOverviewPage } from '@/features/student/TableBookingOverviewPage';
import { TableBookingGridPage } from '@/features/student/TableBookingGridPage';
import { NewBookingPage } from '@/features/student/NewBookingPage';
import { BookingDetailPage } from '@/features/student/BookingDetailPage';
import { BookingHistoryPage } from '@/features/student/BookingHistoryPage';
import { ConversationsPage } from '@/features/student/ConversationsPage';
import { NotificationsPage } from '@/features/student/NotificationsPage';
import { ProfilePage } from '@/features/student/ProfilePage';
import { SettingsPage } from '@/features/student/SettingsPage';

// Admin Pages
import { AdminDashboardPage } from '@/features/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/features/admin/AdminUsersPage';
import { AdminReportsPage } from '@/features/admin/AdminReportsPage';
import { AdminTablesPage } from '@/features/admin/AdminTablesPage';
import { AdminBookingsPage } from '@/features/admin/AdminBookingsPage';
import { AdminAuditLogsPage } from '@/features/admin/AdminAuditLogsPage';

// Error & Preview Pages
import { ForbiddenPage } from '@/features/error/ForbiddenPage';
import { NotFoundPage } from '@/features/error/NotFoundPage';
import { DesignSystemPreviewPage } from '@/features/preview/DesignSystemPreviewPage';

export const routes: RouteObject[] = [
  // 1. Public Marketing Routes
  {
    path: '/',
    element: <MarketingLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      ...(import.meta.env.DEV
        ? [{ path: 'preview/design-system', element: <DesignSystemPreviewPage /> }]
        : []),
    ],
  },

  // 2. Authentication & Callback Routes
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'auth/recovery', element: <AuthRecoveryPage /> },
    ],
  },

  // 3. Student Application Routes (Protected & Gated)
  {
    path: '/app',
    element: (
      <RequireAuth>
        <RequireRole role="ROLE_STUDENT">
          <StudentLayout />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <StudentDashboardPage /> },
      { path: 'study', element: <StudyDiscoveryPage /> },
      { path: 'study/:studentId', element: <StudyDetailPage /> },
      { path: 'study/requests', element: <StudyRequestsPage /> },
      {
        path: 'social',
        element: (
          <RequireSocialConsent>
            <SocialDiscoveryPage />
          </RequireSocialConsent>
        ),
      },
      {
        path: 'social/:studentId',
        element: (
          <RequireSocialConsent>
            <SocialDetailPage />
          </RequireSocialConsent>
        ),
      },
      {
        path: 'social/connections',
        element: (
          <RequireSocialConsent>
            <SocialConnectionsPage />
          </RequireSocialConsent>
        ),
      },
      { path: 'booking', element: <TableBookingOverviewPage /> },
      { path: 'booking/table-grid', element: <TableBookingGridPage /> },
      { path: 'booking/new', element: <NewBookingPage /> },
      { path: 'booking/:bookingId', element: <BookingDetailPage /> },
      { path: 'booking/history', element: <BookingHistoryPage /> },
      { path: 'conversations', element: <ConversationsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },

  // 4. Admin Application Routes (Protected & Gated)
  {
    path: '/admin',
    element: (
      <RequireAuth>
        <RequireRole role="ROLE_ADMIN">
          <AdminLayout />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'reports', element: <AdminReportsPage /> },
      { path: 'tables', element: <AdminTablesPage /> },
      { path: 'bookings', element: <AdminBookingsPage /> },
      { path: 'audit-logs', element: <AdminAuditLogsPage /> },
    ],
  },

  // 5. System Error & Fallback Routes
  {
    path: '/',
    element: <ErrorLayout />,
    children: [
      { path: 'forbidden', element: <ForbiddenPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
