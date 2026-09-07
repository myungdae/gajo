export type EntityInformationKind =
  | 'VEHICLE_ACCESS'
  | 'PARKING'
  | 'TELEPHONE'
  | 'ADDRESS'
  | 'RESERVATION'
  | 'ACCESSIBILITY'
  | 'GENERAL';

export interface EntityInformationResolution {
  kind: EntityInformationKind;
  status: 'ANSWERED' | 'NOT_VERIFIED';
  message: string;
  value?: unknown;
}

function kindOf(requestedAction = '', categoryHint = ''): EntityInformationKind {
  const text = `${requestedAction} ${categoryHint}`;

  if (/차량|자동차|차로|운전|진입|올라/.test(text)) return 'VEHICLE_ACCESS';
  if (/주차/.test(text)) return 'PARKING';
  if (/전화|연락/.test(text)) return 'TELEPHONE';
  if (/주소|위치/.test(text)) return 'ADDRESS';
  if (/예약/.test(text)) return 'RESERVATION';
  if (/휠체어|접근성|무장애|보행/.test(text)) return 'ACCESSIBILITY';

  return 'GENERAL';
}

const known = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  value !== 'UNKNOWN';

export function resolveEntityInformation(
  place: any,
  requestedAction = '',
  categoryHint = '',
): EntityInformationResolution {
  const kind = kindOf(requestedAction, categoryHint);
  const label =
    place?.canonicalLabelKo ||
    place?.displayName ||
    '해당 장소';

  if (kind === 'VEHICLE_ACCESS') {
    const value =
      place?.vehicleAccess ??
      place?.vehicleAccessNotice ??
      place?.drivingAccess ??
      place?.carAccess;

    return known(value)
      ? {
          kind,
          status: 'ANSWERED',
          value,
          message: `${label}의 차량 접근 정보는 다음과 같이 확인되어 있습니다. ${String(value)}`,
        }
      : {
          kind,
          status: 'NOT_VERIFIED',
          message: `${label}을 말씀하시는 것으로 이해했습니다. 현재 검증된 지역 정보에는 차량으로 어디까지 접근할 수 있는지 확인된 정보가 없습니다. 확인되지 않은 내용은 임의로 안내하지 않을게요.`,
        };
  }

  if (kind === 'PARKING') {
    const value = place?.parking;
    return known(value)
      ? {
          kind,
          status: 'ANSWERED',
          value,
          message: `${label}의 주차 정보는 ${String(value)}로 확인되어 있습니다.`,
        }
      : {
          kind,
          status: 'NOT_VERIFIED',
          message: `${label}의 주차 여부는 현재 검증된 지역 정보에서 확인되지 않습니다.`,
        };
  }

  if (kind === 'TELEPHONE' && known(place?.telephone))
    return {
      kind,
      status: 'ANSWERED',
      value: place.telephone,
      message: `${label}의 확인된 전화번호는 ${place.telephone}입니다.`,
    };

  if (kind === 'ADDRESS' && known(place?.address))
    return {
      kind,
      status: 'ANSWERED',
      value: place.address,
      message: `${label}의 확인된 주소는 ${place.address}입니다.`,
    };

  if (kind === 'RESERVATION' && known(place?.reservationUrl))
    return {
      kind,
      status: 'ANSWERED',
      value: place.reservationUrl,
      message: `${label}의 확인된 예약 경로가 있습니다.`,
    };

  if (
    kind === 'ACCESSIBILITY' &&
    Array.isArray(place?.accessibilityNotes) &&
    place.accessibilityNotes.length
  )
    return {
      kind,
      status: 'ANSWERED',
      value: place.accessibilityNotes,
      message: `${label}의 확인된 접근성 안내는 ${place.accessibilityNotes.join(', ')}입니다.`,
    };

  if (kind === 'GENERAL' && known(place?.description))
    return {
      kind,
      status: 'ANSWERED',
      value: place.description,
      message: `${label}은 ${place.description}`,
    };

  return {
    kind,
    status: 'NOT_VERIFIED',
    message: `${label}에 대해 요청하신 정보는 현재 검증된 지역 데이터에서 확인되지 않습니다. 확인되지 않은 내용은 임의로 안내하지 않을게요.`,
  };
}
