# 동·구 자동 확인용 행정동 경계

수거함 좌표 목록과 별도로 사용하는 행정구역 경계자료입니다.

출처: 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr), 공공누리 제1유형. 변경이력 반영·가공: vuski/admdongkor (https://github.com/vuski/admdongkor), CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
대상 버전: ver20260701 / 2026-07-01. 배포자의 원문: https://github.com/vuski/admdongkor/blob/master/LICENSE-DATA
원본: https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson

이 배포본에는 경계 GeoJSON 본문을 포함하지 않았습니다. 최초 위치 확인 때 원본 경계파일(저장소 표기 약 33 MB)을 내려받아 브라우저에서 판정하며, 가능하면 브라우저 Cache Storage에 경계파일만 캐시합니다. 조회 좌표나 사진을 경계자료 서버에 보내지 않습니다. 첫 조회에는 인터넷이 필요합니다. 사진·좌표·입력 주소·GPS 메타데이터는 캐시하지 않습니다. 브라우저 캐시는 영구 보장을 하지 않습니다.

동은 **행정동·읍·면**입니다. 법정동이나 도로명 상세주소를 반환하지 않습니다. 도로명 상세주소가 있는 기존 수거함을 선택하면 그 수거함의 주소를 우선합니다. 행정 경계·GPS의 오차, 경계 중첩, 자료 미포함, 이후 개편이 있을 수 있습니다. 경계에 걸리거나 여러 지역으로 판정되면 하나로 단정하지 않고 직접 확인을 요청합니다. 데이터의 정확성·완전성을 보증하지 않습니다.

정적 자체 호스팅: `python upgrade-tools/prepare-regions.py`를 실행하면 `public/data/regions.geojson`을 준비합니다. 재빌드하거나 해당 파일을 배포 폴더의 `data/regions.geojson`로 복사하세요. 이후 같은 출처의 파일을 먼저 사용합니다. 경계자료 갱신 시 `region-config.json`과 worker CACHE 버전도 함께 갱신하세요.
