# noqa: SIZE_OK -- Excel 변환, 검증, 출력만 담당하는 단일 실행 CLI입니다.
"""`risk_assessment_with_scenarios.xlsx`를 runtime용 scenario JSON으로 변환합니다.

변환 후 `PROCESS_MAP`과 대조해 participant가 선택할 수 없는 조합,
scenario 부족, accident type 부족, 중복 ID를 함께 검증합니다.
`PROCESS_MAP`은 `public/app.js`와 동일하게 유지해야 합니다.

[변환 후 JSON 구조]
{
  "마감공사": {
    "도장 작업": [
      {
        "id": 0,
        "majorProcess": "마감공사",
        "detailProcess": "도장 작업",
        "processContent": "도장 작업",
        "scenario": "작업자가 좁은 실내에서...",
        "accidents": ["떨어짐"],
        "primaryAccident": "떨어짐",
        "riskLevel": "높음(6)"
      },
      ...
    ],
    "방수 작업": [ ... ]
  },
  "골조공사": { ... }
}

[실행]
  python scripts/scenario_to_json.py

[출력]
  reference_data/scenarios.json
"""

import json
import sys
from pathlib import Path
import pandas as pd

# 경로
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
REFERENCE_DIR = PROJECT_ROOT / "reference_data"

INPUT_FILE = REFERENCE_DIR / "risk_assessment_with_scenarios.xlsx"
OUTPUT_FILE = REFERENCE_DIR / "scenarios.json"
OVERRIDE_FILE = REFERENCE_DIR / "scenario_classification_overrides.json"

CANONICAL_ACCIDENT_MAP = {
    "떨어짐": "떨어짐",
    "끼임": "끼임",
    "충돌 및 접촉": "충돌 및 접촉",
    "깔림": "깔림",
    "감전": "감전",
    "절상(절단,찔림,베임)": "절상",
    "절상": "절상",
    "화상": "화상",
    "질병": "질병",
    "질식": "질식",
    "넘어짐": "넘어짐",
    "미끄러짐": "미끄러짐",
}

# 이 mapping이 UI와 달라지면 검증 결과와 participant 선택 경로가 서로 어긋납니다.
PROCESS_MAP = {
    "가설공사": ["가설공사"],
    "토공사": ["토공사"],
    "골조공사": ["거푸집 작업", "철근·철골 작업", "콘크리트"],
    "마감공사": ["마감공사", "미장/견출 작업", "도장 작업", "방수 작업", "조적 작업"],
    "설비공사": ["설비공사"],
    "전기·통신공사": ["전기·통신공사"],
    "양중·운반": ["양중·운반"],
    "운반/자재반입": ["운반/자재반입"],
    "토목·기타": ["토목·기타"],
    "공통": ["공통"],
}

# /api/scenarios 가 카드 3장을 서로 다른 사고분류로 채우므로 최소 기준
MIN_SCENARIOS = 3
MIN_ACCIDENT_TYPES = 3


def parse_accidents(accident_str):
    """사고분류 문자열 → 리스트 (세미콜론 분리, 중복 제거)"""
    if pd.isna(accident_str):
        return []
    items = [a.strip() for a in str(accident_str).split(';') if a.strip()]
    # 중복 제거하되 순서 유지
    seen = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result


def load_classification_overrides():
    """원본 사고분류는 보존하면서 대표 사고유형만 검토 결과로 교정한다."""
    if not OVERRIDE_FILE.exists():
        return {}

    with open(OVERRIDE_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def canonicalize_accident(accident):
    return CANONICAL_ACCIDENT_MAP.get(str(accident).strip(), "미분류")


def validate(result):
    """변환 결과를 UI 선택지와 대조. (errors, warnings) 반환"""
    errors = []
    warnings = []

    print("\n" + "=" * 60)
    print("🔍 UI 선택지 ↔ 데이터 키 검증")
    print("=" * 60)

    # 1) UI 조합 → 데이터 존재 여부
    print("\n   [UI에서 선택 가능한 조합]")
    total_reachable = 0
    for major, details in PROCESS_MAP.items():
        for detail in details:
            items = result.get(major, {}).get(detail, [])
            n = len(items)
            total_reachable += n
            accident_types = {it["primaryAccident"] for it in items if it["primaryAccident"]}

            if n == 0:
                mark = "❌"
                errors.append(f"{major} > {detail}: 시나리오 0개 (참가자가 여기서 막힘)")
            elif n < MIN_SCENARIOS or len(accident_types) < MIN_ACCIDENT_TYPES:
                mark = "⚠️ "
                warnings.append(
                    f"{major} > {detail}: {n}개 / 사고분류 {len(accident_types)}종 "
                    f"— 카드 3장 분산 부족"
                )
            else:
                mark = "✅"
            print(f"   {mark} {major} > {detail}: {n}개 (사고분류 {len(accident_types)}종)")

    # 2) 데이터에 있는데 UI에 없는 키 → 참가자가 영원히 도달 불가
    print("\n   [도달 불가 데이터 점검]")
    orphan_total = 0
    for major, details in result.items():
        if major not in PROCESS_MAP:
            cnt = sum(len(v) for v in details.values())
            orphan_total += cnt
            tag = "슬래시 복합 대공정명" if "/" in major and major not in PROCESS_MAP else "UI에 없는 대공정"
            warnings.append(f"[{tag}] '{major}' — 시나리오 {cnt}개 도달 불가")
            print(f"   ⚠️  '{major}' ({cnt}개) — {tag}")
            continue
        for detail, items in details.items():
            if detail not in PROCESS_MAP[major]:
                orphan_total += len(items)
                warnings.append(f"[UI에 없는 세부공정] '{major} > {detail}' — 시나리오 {len(items)}개 도달 불가")
                print(f"   ⚠️  '{major} > {detail}' ({len(items)}개) — UI 선택지에 없음")
    if orphan_total == 0:
        print("   ✅ 도달 불가 시나리오 없음")

    # 3) 요약
    total_all = sum(len(s) for d in result.values() for s in d.values())
    print(f"\n   커버리지: {total_reachable} / {total_all}개 도달 가능", end="")
    print(" (사각지대 0)" if total_reachable == total_all else f" (사각지대 {total_all - total_reachable}개)")

    # 4) 사고유형 정규화 및 ID 검증
    all_items = [
        item
        for details in result.values()
        for items in details.values()
        for item in items
    ]
    ids = [item["id"] for item in all_items]
    duplicate_ids = sorted({item_id for item_id in ids if ids.count(item_id) > 1})
    unmapped = [
        item
        for item in all_items
        if item.get("canonicalPrimaryAccident") == "미분류"
        or "미분류" in item.get("canonicalAccidents", [])
    ]

    print("\n   [사고유형 정규화]")
    if duplicate_ids:
        errors.append(f"중복 scenarioRowId: {duplicate_ids}")
        print(f"   ❌ 중복 scenarioRowId: {duplicate_ids}")
    else:
        print(f"   ✅ scenarioRowId {len(ids)}개 모두 고유")

    if unmapped:
        bad_ids = [item["id"] for item in unmapped]
        errors.append(f"미분류 사고유형 행: {bad_ids}")
        print(f"   ❌ 미분류 사고유형 행: {bad_ids}")
    else:
        canonical_types = sorted({
            item["canonicalPrimaryAccident"]
            for item in all_items
        })
        print(
            f"   ✅ {len(all_items)}개 모두 정규화 완료 "
            f"({len(canonical_types)}종: {', '.join(canonical_types)})"
        )

    return errors, warnings


def main():
    print("=" * 60)
    print("시나리오 엑셀 → JSON 변환")
    print("=" * 60)
    print(f"📥 입력: {INPUT_FILE}")
    print(f"📤 출력: {OUTPUT_FILE}")

    if not INPUT_FILE.exists():
        print(f"\n❌ 입력 파일을 찾을 수 없습니다: {INPUT_FILE}")
        print("   reference_data의 source workbook과 INPUT_FILE 경로를 확인해주세요.")
        sys.exit(1)

    df = pd.read_excel(INPUT_FILE)
    print(f"\n📂 전체 행: {len(df)}")

    classification_overrides = load_classification_overrides()
    print(f"   사고 대표유형 검토 오버라이드: {len(classification_overrides)}건")

    # 시나리오가 비어있지 않은 행만
    df_valid = df[df['시나리오_형식예시'].notna() & (df['시나리오_형식예시'].str.strip() != '')]
    print(f"   유효 시나리오 행: {len(df_valid)}")

    # 중첩 구조로 변환: 대공정 → 세부공정 → [시나리오들]
    result = {}

    for idx, row in df_valid.iterrows():
        major = str(row['대공정']).strip()
        detail = str(row['세부공정']).strip()
        process_content = str(row['공정내용']).strip() if pd.notna(row['공정내용']) else ''
        scenario = str(row['시나리오_형식예시']).strip()
        accidents = parse_accidents(row.get('사고분류'))
        original_accidents = list(accidents)
        override = classification_overrides.get(str(int(idx)), {})

        for accident in override.get("addAccidents", []):
            if accident and accident not in accidents:
                accidents.append(accident)

        primary_accident = override.get(
            "primaryAccident",
            accidents[0] if accidents else ""
        )

        if primary_accident and primary_accident not in accidents:
            accidents.append(primary_accident)

        canonical_accidents = [
            canonicalize_accident(accident)
            for accident in accidents
        ]
        canonical_primary = canonicalize_accident(primary_accident)
        risk_level = str(row.get('위험성', '')).strip() if pd.notna(row.get('위험성')) else ''

        # 중첩 dict 초기화
        if major not in result:
            result[major] = {}
        if detail not in result[major]:
            result[major][detail] = []

        # 시나리오 항목 추가
        result[major][detail].append({
            "id": int(idx),
            "majorProcess": major,
            "detailProcess": detail,
            "processContent": process_content,
            "scenario": scenario,
            "accidents": accidents,
            "originalAccidents": original_accidents,
            "primaryAccident": primary_accident,
            "canonicalAccidents": canonical_accidents,
            "canonicalPrimaryAccident": canonical_primary,
            "riskLikelihood": str(row.get('위험 가능성', '')).strip() if pd.notna(row.get('위험 가능성')) else '',
            "riskSeverity": str(row.get('위험 중대성', '')).strip() if pd.notna(row.get('위험 중대성')) else '',
            "riskLevel": risk_level,
            "hazard": str(row.get('유해위험요인', '')).strip() if pd.notna(row.get('유해위험요인')) else '',
            "measures": str(row.get('감소대책', '')).strip() if pd.notna(row.get('감소대책')) else '',
            "legalBasis": str(row.get('관련근거(법규)', '')).strip() if pd.notna(row.get('관련근거(법규)')) else '',
            "classificationReview": {
                "status": "reviewed_override" if override else "source_classification",
                "reason": override.get("reason", "원본 사고분류의 첫 번째 값을 대표유형으로 사용")
            }
        })

    # 통계
    total_scenarios = sum(
        len(scenarios)
        for detail_dict in result.values()
        for scenarios in detail_dict.values()
    )

    print(f"\n📊 변환 결과:")
    print(f"   대공정: {len(result)}개")
    print(f"   전체 시나리오: {total_scenarios}개")

    print(f"\n   [대공정별 시나리오 수]")
    for major, details in result.items():
        count = sum(len(s) for s in details.values())
        print(f"   - {major}: {count}개 ({len(details)}개 세부공정)")

    errors, warnings = validate(result)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 저장 완료: {OUTPUT_FILE}")
    print(f"   파일 크기: {OUTPUT_FILE.stat().st_size / 1024:.1f} KB")

    print("\n" + "=" * 60)
    if warnings:
        print(f"⚠️  경고 {len(warnings)}건")
        for w in warnings:
            print(f"   - {w}")
    if errors:
        print(f"\n❌ 오류 {len(errors)}건 — 실험 전 반드시 수정할 것")
        for e in errors:
            print(f"   - {e}")
        print("\n   조치: 엑셀의 대공정/세부공정 표기를 고치거나,")
        print("         public/app.js 의 PROCESS_MAP 에서 해당 선택지를 제거하세요.")
        print("=" * 60)
        sys.exit(1)
    if not warnings:
        print("✅ 검증 통과 — UI 선택지와 데이터 키가 완전히 일치합니다.")
    print("=" * 60)


if __name__ == "__main__":
    main()
