import { AppServices, ServiceContext } from '@/services/interfaces';
import { AppError } from '@/types';

function unavailable<T>(): Promise<T> {
  return Promise.reject(
    new AppError('SERVICE_UNAVAILABLE', 'SERVICE_UNAVAILABLE: Service integration pending for production deployment.', {
      isTransient: false,
    })
  );
}

export class UnavailableServiceAdapter implements AppServices {
  public static connection = {
    sendConnectionRequest: (_t: string, _m: unknown, _n: unknown, _context: ServiceContext) => unavailable<never>(),
    listConnections: (_m: unknown, _context: ServiceContext) => unavailable<never>(),
    getConnection: (_id: string, _context: ServiceContext) => unavailable<never>(),
    listConnectionSummaries: (_mode: unknown, _bucket: unknown, _context: ServiceContext) => unavailable<never>(),
    getConnectionDetail: (_id: string, _context: ServiceContext) => unavailable<never>(),
    getConnectionCounts: (_mode: unknown, _context: ServiceContext) => unavailable<never>(),
    resetDemoState: (_context: ServiceContext) => unavailable<void>(),
  };

  public auth = {
    getCurrentSession: (_context?: ServiceContext) => unavailable<null>(),
    loginWithDemoRole: (_role: unknown, _context?: ServiceContext) => unavailable<never>(),
    logout: (_context?: ServiceContext) => unavailable<void>(),
    refreshToken: (_context?: ServiceContext) => unavailable<never>(),
  };

  public profile = {
    getPrivateProfile: (_context: ServiceContext) => unavailable<never>(),
    updatePrivateProfile: (_req: unknown, _context: ServiceContext) => unavailable<never>(),
    completeOnboarding: (_req: unknown, _context: ServiceContext) => unavailable<never>(),
    getPublicStudyProfile: (_target: string, _context: ServiceContext) => unavailable<never>(),
    getSelfStudyPreview: (_context: ServiceContext) => unavailable<never>(),
    getSelfSocialPreview: (_context: ServiceContext) => unavailable<never>(),
  };

  public study = {
    getStudyConsent: (_context: ServiceContext) => unavailable<never>(),
    updateStudyConsent: (_optIn: boolean, _context: ServiceContext) => unavailable<never>(),
    listStudyPartners: (_options: unknown, _context: ServiceContext) => unavailable<never>(),
    getStudyPartner: (_id: string, _context: ServiceContext) => unavailable<never>(),
    recordStudyAction: (_id: string, _a: unknown, _context: ServiceContext) => unavailable<never>(),
    submitMatchingQuery: (_c: string, _p: unknown, _context: ServiceContext) => unavailable<never>(),
    getMatchingStatus: (_id: string, _context: ServiceContext) => unavailable<never>(),
    resetDiscoveryRound: (_context: ServiceContext) => unavailable<never>(),
  };

  public social = {
    getSocialConsent: (_context: ServiceContext) => unavailable<never>(),
    updateSocialConsent: (_optIn: boolean, _context: ServiceContext) => unavailable<never>(),
    listSocialPeers: (_options: unknown, _context: ServiceContext) => unavailable<never>(),
    getSocialPeer: (_id: string, _context: ServiceContext) => unavailable<never>(),
    recordSocialAction: (_id: string, _a: unknown, _context: ServiceContext) => unavailable<never>(),
    resetSocialDiscoveryRound: (_context: ServiceContext) => unavailable<never>(),
    listSocialConnections: (_context: ServiceContext) => unavailable<never>(),
  };

  public connection = UnavailableServiceAdapter.connection;

  public booking = {
    listLocations: (_context: ServiceContext) => unavailable<never>(),
    listTableAvailability: (_loc: string, _date: string, _context: ServiceContext) => unavailable<never>(),
    getBooking: (_id: string, _context: ServiceContext) => unavailable<never>(),
    createBooking: (_req: unknown, _context: ServiceContext) => unavailable<never>(),
    reconcileBooking: (_clientOpId: string, _context: ServiceContext) => unavailable<never>(),
    rescheduleBooking: (_req: unknown, _context: ServiceContext) => unavailable<never>(),
    cancelBooking: (_id: string, _context: ServiceContext) => unavailable<never>(),
    getMyBookings: (_context: ServiceContext) => unavailable<never>(),
  };

  public notification = {
    listNotifications: (_filtersOrContext: unknown, _context?: ServiceContext) => unavailable<never>(),
    markAsRead: (_id: string, _context: ServiceContext) => unavailable<never>(),
    markAsUnread: (_id: string, _context: ServiceContext) => unavailable<never>(),
    markAllAsRead: (_context: ServiceContext) => unavailable<never>(),
    getUnreadCount: (_context: ServiceContext) => unavailable<never>(),
  };

  public moderation = {
    reportUser: (_id: string, _c: string, _d: string, _context: ServiceContext) => unavailable<never>(),
    blockUser: (_id: string, _context: ServiceContext) => unavailable<never>(),
    listBlockedUsers: (_context: ServiceContext) => unavailable<never>(),
    listMyReports: (_context: ServiceContext) => unavailable<never>(),
  };

  public admin = {
    listModerationReports: (_context: ServiceContext) => unavailable<never>(),
    resolveReport: (_id: string, _request: unknown, _context: ServiceContext) => unavailable<never>(),
    listAuditLogs: (_context: ServiceContext) => unavailable<never>(),
    getDashboardSummary: (_context: ServiceContext) => unavailable<never>(),
    listUsers: (_search: string | undefined, _context: ServiceContext) => unavailable<never>(),
    getUser: (_id: string, _context: ServiceContext) => unavailable<never>(),
    listResources: (_context: ServiceContext) => unavailable<never>(),
    createLocation: (_request: unknown, _context: ServiceContext) => unavailable<never>(),
    updateLocation: (_id: string, _request: unknown, _context: ServiceContext) => unavailable<never>(),
    deactivateLocation: (_id: string, _reason: string, _confirm: boolean, _context: ServiceContext) => unavailable<never>(),
    listTables: (_context: ServiceContext) => unavailable<never>(),
    createTable: (_request: unknown, _context: ServiceContext) => unavailable<never>(),
    updateTable: (_id: string, _request: unknown, _context: ServiceContext) => unavailable<never>(),
    setTableActive: (_id: string, _active: boolean, _reason: string, _confirm: boolean, _context: ServiceContext) => unavailable<never>(),
    createSlot: (_request: unknown, _context: ServiceContext) => unavailable<never>(),
    listSlots: (_context: ServiceContext) => unavailable<never>(),
    updateSlot: (_id: string, _request: unknown, _context: ServiceContext) => unavailable<never>(),
    setSlotActive: (_id: string, _active: boolean, _reason: string, _confirm: boolean, _context: ServiceContext) => unavailable<never>(),
    listBookings: (_filters: unknown, _context: ServiceContext) => unavailable<never>(),
    cancelBooking: (_id: string, _reason: string, _confirm: boolean, _context: ServiceContext) => unavailable<never>(),
  };

  public conversation = {
    listConversations: (_context: ServiceContext) => unavailable<never>(),
    sendMessage: (_id: string, _c: string, _context: ServiceContext) => unavailable<never>(),
  };
}
