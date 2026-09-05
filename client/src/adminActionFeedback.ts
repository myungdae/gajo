const messageOf = (error: any) => {
  const value = error?.response?.data?.message;
  return Array.isArray(value) ? value.join(" ") : String(value || "");
};

export function actionChannelError(error: any) {
  const status = error?.response?.status;
  const message = messageOf(error);

  if (status === 401 || status === 403)
    return "이 지역을 수정할 권한이 없습니다. 관리자 토큰과 현재 관리 지역을 확인해 주세요.";
  if (status === 404)
    return "선택한 업체 또는 연결 정보를 찾지 못했습니다. 업체를 다시 선택해 주세요.";
  if (status === 409)
    return "다른 작업에서 먼저 변경되었습니다. 최신 정보를 다시 조회한 뒤 저장해 주세요.";
  if (status === 400 && /review due|verification/i.test(message))
    return "재검수 기한이 올바르지 않습니다. 오늘 이후 1년 이내의 날짜를 선택해 주세요.";
  if (status === 400 && /url|https|naver|kakao|booking/i.test(message))
    return "연결 URL 또는 공식 근거 URL 형식을 확인해 주세요. 공개된 HTTPS 주소만 사용할 수 있습니다.";
  if (status === 400)
    return "입력 내용을 저장할 수 없습니다. 표시명·연결 주소·공식 근거·재검수 기한을 확인해 주세요.";
  return "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

export function regionalActionError(error: any) {
  const status = error?.response?.status;

  if (status === 401 || status === 403)
    return "이 지역을 검수할 권한이 없습니다. 관리자 토큰과 현재 관리 지역을 확인해 주세요.";
  if (status === 404)
    return "검수할 지역 데이터를 찾지 못했습니다. 목록을 다시 조회해 주세요.";
  if (status === 409)
    return "다른 작업에서 데이터가 먼저 변경되었습니다. 최신 정보를 다시 조회해 주세요.";
  if (status === 400)
    return "검수 조건을 충족하지 못했습니다. 출처와 필수 정보를 확인해 주세요.";
  return "조치를 적용하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
