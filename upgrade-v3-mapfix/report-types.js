export const categories = {
    overflow: { label: "수거함 넘침", short: "넘침", color: "#e78b35", description: "옷이 가득 차 투입구를 사용하기 어려워요." },
    dumping: { label: "주변 적치", short: "주변 적치", color: "#da6656", description: "수거함 주변에 봉투나 물건이 쌓여 있어요." },
    damage: { label: "파손·노후", short: "파손", color: "#8b77be", description: "문이 열려 있거나 수거함이 파손되어 있어요." },
    no_label: { label: "관리자 표시 확인 어려움", short: "표시 확인", color: "#98754e", description: "관리자 표시가 없거나 읽기 어려워요." },
    normal: { label: "양호", short: "양호", color: "#078269", description: "수거함과 주변이 정돈되어 있어요." },
    uncertain: { label: "확인 필요", short: "확인 필요", color: "#76838e", description: "사진만으로 상태를 판단하기 어려워요." },
};
export const statuses = { reported: "제보 기록", submitted: "기관 접수 기록", resolved: "해결 확인" };
export const samples = [
    { id: "sample-1", address: "서울 마포구 연남동 · 골목 입구", description: "수거함 투입구까지 옷이 차 있어요. 다음 수거 때 확인이 필요해요.", category: "overflow", status: "reported", latitude: 37.5639, longitude: 126.9223, analysis: "예시", created_at: 0, updated_at: 0, isMine: false, sample: true },
    { id: "sample-2", address: "서울 마포구 서교동 · 주택가", description: "수거함 옆으로 큰 봉투가 쌓여 보행 공간이 좁아졌어요.", category: "dumping", status: "submitted", latitude: 37.5581, longitude: 126.9254, analysis: "예시", created_at: 0, updated_at: 0, isMine: false, sample: true },
    { id: "sample-3", address: "서울 마포구 동교동 · 골목길", description: "수거함 문과 손잡이가 파손되어 있어요.", category: "damage", status: "reported", latitude: 37.5618, longitude: 126.9279, analysis: "예시", created_at: 0, updated_at: 0, isMine: false, sample: true },
    { id: "sample-4", address: "서울 마포구 연남동 · 주택가", description: "주변 적치물이 정리된 것을 확인했어요.", category: "normal", status: "resolved", latitude: 37.5658, longitude: 126.9265, analysis: "예시", created_at: 0, updated_at: 0, isMine: false, sample: true },
];
export function complaintText(r) {
    return `[의류수거함 현장 확인 요청]\n\n위치: ${r.address}${r.latitude !== null ? `\n좌표: ${r.latitude}, ${r.longitude}` : ""}\n관찰 일시: ${r.sample ? "예시 기록" : new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}\n확인한 상태: ${r.issues && Object.values(r.issues).some(Boolean) ? Object.keys(r.issues).filter(k => r.issues?.[k]).map(k => categories[k].label).join(', ') : categories[r.category].label}\n\n${r.description || categories[r.category].description}\n\n위 위치의 의류수거함 및 주변 상태를 확인하고, 필요시 수거·정비 등 적절한 조치를 부탁드립니다. 설치 허가 여부와 관리 주체는 확인되지 않았으므로 함께 확인 부탁드립니다.\n\n첨부: 현장 사진 1장 (연계 자동 접수 시 함께 전송 / 직접 접수 시 별도 첨부)\n\n※ 제출 전 위치와 내용을 확인해 주세요. 이 문서는 시민이 관찰한 내용을 바탕으로 작성한 초안입니다.`;
}
