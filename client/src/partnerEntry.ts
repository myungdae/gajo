import type { PublicPartner } from "./api/client";
import type { TripSession } from "./tripSession";
export function applyPartnerEntryToTrip(
  trip: TripSession,
  partner: PublicPartner,
  enteredAt = new Date().toISOString(),
): TripSession {
  if (trip.regionId !== partner.regionId)
    throw new Error("partner region mismatch");
  return {
    ...trip,
    mode: "NOW",
    partnerEntryContext: {
      partnerId: partner.partnerId,
      partnerSlug: partner.partnerSlug,
      partnerName: partner.displayName,
      enteredAt,
      source: "PARTNER_QR",
    },
  };
}
