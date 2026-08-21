import type { ConciergeChatResponse, CreateContextInput } from './api/client';

export type ExplicitJourneyContext = {
  requestedDestinations: NonNullable<ConciergeChatResponse['requestedDestinations']>;
  multiDestination: true;
  sourceTurnId: string;
};

export function captureExplicitJourney(result: ConciergeChatResponse, turnId: string, current?: ExplicitJourneyContext): ExplicitJourneyContext | undefined {
  if ((result.requestedDestinations?.length || 0) > 1)
    return current || { requestedDestinations: result.requestedDestinations!, multiDestination: true, sourceTurnId: turnId };
  return current;
}

export function explicitJourneyPayload(journey?: ExplicitJourneyContext): Pick<CreateContextInput, 'explicitJourney'|'mustVisitPlaces'> {
  return journey ? { explicitJourney: journey, mustVisitPlaces: journey.requestedDestinations } : {};
}
