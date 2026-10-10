import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, ArrowRight, Settings } from 'lucide-react';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { Button } from '@/components/ui/Button';

export interface RequireSocialConsentProps {
  children: ReactNode;
}

/**
 * RequireSocialConsent Guard
 *
 * Provisional client guard implementing independent consent architecture:
 * Study and Social discovery modes require separate, revokable consent.
 * Never silently opts a student into social discovery.
 * Access to Settings (/app/settings) is never blocked by this guard.
 */
export const RequireSocialConsent: React.FC<RequireSocialConsentProps> = ({ children }) => {
  const { socialConsent, grantSocialConsent } = useDemoAuth();

  if (!socialConsent) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-xl border border-ember-500/30 bg-craft-card craft-radial-glow text-center space-y-5">
        <div className="w-12 h-12 rounded-full bg-ember-900/40 border border-ember-500/40 flex items-center justify-center text-ember-400 mx-auto">
          <Users className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-craft-ink">
            Activate Social Discovery Mode
          </h2>
          <p className="text-xs text-craft-muted leading-relaxed max-w-md mx-auto">
            Social networking is independent from academic study matching. Opting in requires an explicit action. In this demonstration, clicking activate grants provisional local consent.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-left text-xs space-y-2 text-craft-muted">
          <div className="flex items-center gap-2 text-craft-ink font-medium">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Provisional Consent Policy (Under Review)</span>
          </div>
          <p className="text-[11px] leading-normal">
            • Your academic study profile remains fully active even if social discovery is disabled.
            <br />
            • Dating algorithms and sensitive personal fields are strictly omitted.
            <br />
            • You can manage or revoke consent at any time in Privacy Settings.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button variant="ember" onClick={grantSocialConsent} rightIcon={<ArrowRight className="w-4 h-4" />}>
            Activate Social Mode (Demo Action)
          </Button>
          <Link to="/app/settings">
            <Button variant="outline" leftIcon={<Settings className="w-3.5 h-3.5" />}>
              Privacy Settings
            </Button>
          </Link>
          <Link to="/app/dashboard">
            <Button variant="ghost">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
