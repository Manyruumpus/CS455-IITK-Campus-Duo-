/**
 * Application feature flags and runtime environment configuration.
 *
 * Centralizes isolation rules for development, default production, and demo showcase.
 */

export interface AppFeatureFlags {
  /** Vite development environment */
  isDev: boolean;
  /** Explicit demo showcase build (e.g. staging preview deployment) */
  isDemoShowcase: boolean;
  /** Whether demo authentication controls & mock bypasses are permitted */
  isDemoAuthEnabled: boolean;
  /** Whether design-system preview route (/preview/design-system) is registered */
  isDesignSystemPreviewEnabled: boolean;
  /** Whether peer conversations route (/app/conversations) is registered (DEC-08) */
  isMessagingEnabled: boolean;
  /** Configured partner booking approval simulation policy */
  demoPartnerApprovalPolicy: 'AUTO_APPROVED_DEMO' | 'REQUIRES_EXPLICIT_APPROVAL';
}

export const getAppConfig = (): AppFeatureFlags => {
  const isDev = Boolean(import.meta.env.DEV);
  const isDemoShowcase = import.meta.env.VITE_DEMO_SHOWCASE === 'true';
  const isDemoModeExplicit = import.meta.env.VITE_DEMO_MODE === 'true';

  // Demo authentication controls are strictly active ONLY in dev or explicitly configured demo showcase
  const isDemoAuthEnabled = isDev || isDemoShowcase || isDemoModeExplicit;

  // Design system workbench is restricted to dev or explicit demo showcase (and can be suppressed with VITE_ENABLE_PREVIEW=false)
  const isDesignSystemPreviewEnabled =
    (isDev || isDemoShowcase) && import.meta.env.VITE_ENABLE_PREVIEW !== 'false';

  // In-app messaging is feature-flagged under DEC-08 and disabled unless explicitly turned on
  const isMessagingEnabled = import.meta.env.VITE_ENABLE_MESSAGING === 'true';

  // Partner booking approval simulation policy (default: AUTO_APPROVED_DEMO with visible provisional badge)
  const demoPartnerApprovalPolicy: 'AUTO_APPROVED_DEMO' | 'REQUIRES_EXPLICIT_APPROVAL' =
    import.meta.env.VITE_PARTNER_APPROVAL_POLICY === 'REQUIRES_EXPLICIT_APPROVAL'
      ? 'REQUIRES_EXPLICIT_APPROVAL'
      : 'AUTO_APPROVED_DEMO';

  return {
    isDev,
    isDemoShowcase,
    isDemoAuthEnabled,
    isDesignSystemPreviewEnabled,
    isMessagingEnabled,
    demoPartnerApprovalPolicy,
  };
};

export const appConfig = getAppConfig();
