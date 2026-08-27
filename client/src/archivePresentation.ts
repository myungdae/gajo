import { itinerarySteps, savedPlaceItems } from "./journeyExecution.ts";
import { canonicalEntityId } from "./recommendationItem.ts";
import type { TripSession } from "./tripSession.ts";

export const DEFAULT_ARCHIVE_COUNT = 4;

const statusOf = (trip: TripSession, item: any) => {
  const entityId = canonicalEntityId(item);
  return (entityId && trip.execution?.statusByEntityId?.[entityId]) || item.status || "PLANNED";
};

export function archivedTripSummary(trip: TripSession) {
  const steps = itinerarySteps(trip.itinerary);
  const saved = savedPlaceItems(trip);
  const completed = steps.filter((step) => statusOf(trip, step) === "COMPLETED");
  const skipped = steps.filter((step) => statusOf(trip, step) === "SKIPPED");
  const newlyAdded = steps.filter((step) => statusOf(trip, step) === "NEWLY_ADDED");
  const replaced = (trip.replanHistory || []).flatMap((event) => event.replacedSteps || []);
  return { steps, saved, completed, skipped, newlyAdded, replaced };
}

export function archivedTripDate(trip: TripSession) {
  const value = trip.plannedContext?.startDate || trip.createdAt;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "날짜 미상"
    : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
}
