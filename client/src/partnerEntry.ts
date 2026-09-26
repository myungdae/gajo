import type { OntologyEntityDetail, PublicPartner } from "./api/client";
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

export interface PartnerEntryAnchor {
  entityId: string;
  label: string;
  latitude: number;
  longitude: number;
}

export function partnerEntryAnchor(
  partner: PublicPartner,
  facility: OntologyEntityDetail,
): PartnerEntryAnchor | undefined {
  const latitude = Number(facility.literalProps?.latitude);
  const longitude = Number(facility.literalProps?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return undefined;
  }

  return {
    entityId: partner.canonicalEntityId,
    label: facility.label || partner.displayName,
    latitude,
    longitude,
  };
}
