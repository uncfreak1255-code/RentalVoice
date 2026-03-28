import type { ServerVoiceReadiness } from './api-client';

export function canGenerateDraft(
  readiness: { state: ServerVoiceReadiness['state'] | 'unknown' } | null | undefined
): boolean {
  return readiness == null || readiness.state !== 'unknown';
}

export function canAutoSend(
  readiness: Pick<ServerVoiceReadiness, 'autopilotEligible'> | null | undefined
): boolean {
  return readiness?.autopilotEligible === true;
}
