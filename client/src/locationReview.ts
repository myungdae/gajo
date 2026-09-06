export type LocationAuth = { kind: "admin" | "copilot"; token: string };
export interface LocationForm {
  latitude: string;
  longitude: string;
  normalizedAddress: string;
  sourceType: string;
  sourceReference: string;
  reason: string;
}
export function locationPair(latitude: unknown, longitude: unknown) {
  if (
    (typeof latitude !== "number" && typeof latitude !== "string") ||
    (typeof longitude !== "number" && typeof longitude !== "string") ||
    String(latitude).trim() === "" ||
    String(longitude).trim() === ""
  )
    return undefined;
  const lat = Number(latitude),
    lng = Number(longitude);
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
    ? { latitude: lat, longitude: lng }
    : undefined;
}
export function locationPayload(form: LocationForm) {
  const pair = locationPair(form.latitude, form.longitude);
  if (
    !pair ||
    !form.normalizedAddress.trim() ||
    !form.sourceType ||
    form.sourceReference.trim().length < 3 ||
    form.reason.trim().length < 5
  )
    throw new Error("좌표·주소·출처·변경 사유(5자 이상)를 확인해 주세요.");
  return {
    ...pair,
    normalizedAddress: form.normalizedAddress.trim(),
    sourceType: form.sourceType,
    sourceReference: form.sourceReference.trim(),
    reason: form.reason.trim(),
  };
}
export function locationMutation(
  precondition: { expectedVersion: number; expectedHash: string },
  values: object,
  requestId = crypto.randomUUID(),
) {
  return { ...values, precondition: { ...precondition, requestId } };
}
export async function locationRequest(
  auth: LocationAuth,
  regionId: string,
  path = "",
  body?: unknown,
  fetcher: typeof fetch = fetch,
) {
  if (!auth.token || !regionId)
    throw new Error("담당 지역과 관리자 인증을 확인해 주세요.");
  const response = await fetcher(
    `/api/${auth.kind === "copilot" ? "copilot" : "admin"}/locations${path}${path.includes("?") ? "&" : "?"}regionId=${encodeURIComponent(regionId)}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth.kind === "copilot"
          ? { Authorization: `Bearer ${auth.token}` }
          : { "x-admin-token": auth.token }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    },
  ).catch(() => { throw new Error("서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요."); });
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? "다른 변경과 충돌했습니다. 새로 불러온 내용을 검토해 주세요."
        : response.status === 401
          ? "로그인 인증이 만료되었거나 유효하지 않습니다 (401). 다시 로그인해 주세요."
          : response.status === 403
            ? "이 지역의 위치정보 관리 권한이 없습니다 (403). 담당 지역과 계정 권한을 확인해 주세요."
          : "요청을 처리하지 못했습니다. 좌표·출처·지역 경계와 검토 상태를 확인해 주세요.",
    );
  try {
    return await response.json();
  } catch {
    throw new Error("서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
export const locationStatusLabels: Record<string, string> = {
  PROPOSED: "검토 대기",
  APPROVED: "좌표 승인 완료",
  REJECTED: "반려됨",
  RESTORED: "이전 좌표로 복원됨",
  UNVERIFIED: "위치 미확인",
  LEGACY_APPROVED: "기존 승인 좌표",
  VERIFIED: "검증 완료",
};
export const locationSourceLabels: Record<string, string> = {
  OFFICIAL_LOCAL_GOV: "지자체 공식 정보",
  OFFICIAL_BUSINESS: "공식 사업자 정보",
  OFFICIAL_MAP_LISTING: "공식 지도 정보",
  KTO: "한국관광공사",
  FIELD_SURVEY: "현장 확인",
  OTHER_VERIFIED_SOURCE: "기타 확인 근거",
};
