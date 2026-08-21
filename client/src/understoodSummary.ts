const objectParticle = (value: string) => {
  const last = value.at(-1) || "";
  if (!/[가-힣]/.test(last)) return `${value}을`;
  return `${value}${(last.charCodeAt(0) - 0xac00) % 28 === 0 ? "를" : "을"}`;
};

export function understoodSummary(result: any): string {
  const discovery = result?.discovery;
  if (!discovery)
    return "말씀하신 방문 상황을 바탕으로 일정을 구성했습니다.";
  const anchor = discovery.anchorLabel
    ? `${objectParticle(discovery.anchorLabel)} 기준으로`
    : "현재 장소를 기준으로";
  const target =
    discovery.category === "CAFE"
      ? "주변에서 차를 마실 수 있는 카페를"
      : discovery.category === "FOOD"
        ? "주변에서 식사할 수 있는 곳을"
        : discovery.category === "TOURISM_NATURE"
          ? "주변에서 둘러볼 만한 곳을"
          : "주변에서 요청하신 조건에 맞는 장소를";
  return `${anchor} ${target} 찾았습니다.`;
}
