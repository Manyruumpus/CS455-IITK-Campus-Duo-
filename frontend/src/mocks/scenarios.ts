import { AppError, AppErrorCode } from '@/types';

export interface ScenarioControls {
  forceDelayMs?: number;
  forceError?: AppErrorCode;
  forceAgentFallback?: boolean;
  forceUncertainMutation?: boolean;
}

class ScenarioManager {
  private scenarios: ScenarioControls = {};

  public setScenario(controls: Partial<ScenarioControls>): void {
    this.scenarios = { ...this.scenarios, ...controls };
  }

  public getScenario(): ScenarioControls {
    return { ...this.scenarios };
  }

  public setForceErrorState(forceError: AppErrorCode | undefined): void {
    this.scenarios = { ...this.scenarios, forceError };
  }

  public reset(): void {
    this.scenarios = {};
  }

  /**
   * Evaluates active scenario rules and injects simulated latency or errors.
   * Listens to the AbortSignal to cancel pending delays immediately.
   */
  public async applyScenario(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new DOMException('Aborted by client', 'AbortError');
    }

    if (this.scenarios.forceDelayMs && this.scenarios.forceDelayMs > 0) {
      if (signal?.aborted) {
        throw new AppError('CANCELLED', 'Aborted during delay', { isTransient: false });
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve();
        }, this.scenarios.forceDelayMs);

        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              reject(new AppError('CANCELLED', 'Aborted during delay', { isTransient: false }));
            },
            { once: true }
          );
        }
      });
    }

    if (this.scenarios.forceError) {
      const code = this.scenarios.forceError;
      throw new AppError(code, `Simulated scenario error: ${code}`, {
        isTransient: code === 'SERVICE_UNAVAILABLE',
      });
    }
  }
}

export const scenarioManager = new ScenarioManager();
