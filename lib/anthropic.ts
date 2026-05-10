/**
 * Claude API 모델 설정 — 한 곳에서 관리
 *
 * 모델 변경 시 이 파일만 수정하면 transcribe, ocr 라우트 모두 반영됨.
 * snapshot 고정: alias(claude-sonnet-4-6)는 향후 4.7 등으로 자동 교체될 수 있으므로
 * 운영 안정성을 위해 snapshot ID 사용 권장. 단, 현재 Sonnet 4.6은
 * alias와 snapshot이 동일(claude-sonnet-4-6)하므로 그대로 사용.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6";
