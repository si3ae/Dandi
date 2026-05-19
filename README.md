# 단디 — AI 장부 비서

부산 사투리 음성, 손글씨 장부, 영수증, 세금계산서를 AI로 인식해서 자동으로 장부에 기록해주는 모바일 웹앱.

- **음성 인식**: OpenAI Whisper API → Claude로 거래 항목 파싱
- **OCR**: Anthropic Claude Vision API (손글씨 / 영수증 / 세금계산서)
- **저장**: 브라우저 `localStorage` (서버 DB 없이 동작)
- **스택**: Next.js 14 (App Router) + TypeScript

## 1. 로컬 개발

```bash
npm install
cp .env.example .env.local
# .env.local 편집: OPENAI_API_KEY, ANTHROPIC_API_KEY 입력
npm run dev
```

http://localhost:3000 접속.

> 마이크 권한이 필요하므로 `localhost` 또는 HTTPS 환경에서만 음성 입력이 동작합니다.

## 2. 환경변수

| 키 | 발급처 |
|---|---|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |

## 3. Vercel 배포

### 방법 A: GitHub 연동 (추천)

1. 이 폴더를 GitHub 리포지토리로 푸시
2. https://vercel.com/new 에서 해당 리포지토리 import
3. **Environment Variables** 에 두 개 추가:
   - `OPENAI_API_KEY`
   - `ANTHROPIC_API_KEY`
4. Deploy 클릭 → 자동으로 빌드되고 `https://<프로젝트명>.vercel.app` 발급

### 방법 B: Vercel CLI

```bash
npm i -g vercel
vercel              # 첫 배포 (프로젝트 생성)
vercel env add OPENAI_API_KEY
vercel env add ANTHROPIC_API_KEY
vercel --prod       # 프로덕션 배포
```

## 4. 폴더 구조

```
app/
  api/
    transcribe/route.ts   # POST: 음성 → 텍스트(Whisper) → 장부 항목(Claude)
    ocr/route.ts          # POST: 이미지(handwriting/receipt/taxinvoice) → JSON(Claude Vision)
  page.tsx                # 메인 SPA (탭 라우팅)
  layout.tsx
  globals.css
components/
  VoiceInput.tsx          # MediaRecorder + /api/transcribe 호출
  ImageOcr.tsx            # 카메라/갤러리 + /api/ocr 호출 (3가지 모드 공용)
lib/
  storage.ts              # Entry 타입 + localStorage 헬퍼
```

## 5. API 엔드포인트

두 라우트 모두 Anthropic **tool use (structured output)** 로 응답을 강제하므로
자유 텍스트 JSON 파싱에 의한 실패가 없습니다. 파일 크기·MIME 타입도 서버에서 검증합니다.

### `POST /api/transcribe`
- form-data: `audio` (Blob, webm/mp4/wav 등, 최대 10MB)
- 처리: Whisper(`whisper-1`, 도메인 prompt 힌트 포함) → Claude(`record_entries` tool)
- 응답: `{ text: string, items: Array<Item> }`
  ```ts
  type Item = {
    date?: string;         // YYYY-MM-DD (KST)
    account: string;       // 계정과목
    description: string;
    vendor?: string;
    type: "in" | "out";
    total: number;         // 부가세 포함 합계 (원)
    evidence: "tax_invoice" | "cash_receipt" | "card" | "simple_receipt" | "none";
    confidence?: number;   // 0.0~1.0
  }
  ```

### `POST /api/ocr`
- form-data: `image` (JPEG/PNG/WebP/GIF, 최대 5MB), `mode` (`handwriting` | `receipt` | `taxinvoice`)
- 처리: Claude Vision + 모드별 tool schema
- 응답:
  - 성공: `{ mode, result }` (handwriting은 배열, 나머지는 단일 객체)
  - 판독 불가: `{ mode, result: null, unreadable: true }`
  - 실패: `{ error: string }` + 4xx/5xx status

## 6. 모델 변경

- Whisper 모델: `app/api/transcribe/route.ts` → `model: "whisper-1"`
- Claude 모델: 두 라우트 상단의 `CLAUDE_MODEL = "claude-sonnet-4-5"` 상수
- 운영에서는 alias(`claude-sonnet-4-5`) 대신 **snapshot ID** (예: `claude-sonnet-4-5-20250929`)로 고정하는 것을 권장합니다. alias는 뒤의 모델이 교체되면서 출력 스타일이 바뀔 수 있습니다.

## 7. 테스트 및 품질 체크

```bash
npm run typecheck   # tsc --noEmit — 타입 에러 확인
npm run test        # lib/vat.test.ts — 부가세 로직 경계값 테스트
npm run lint        # next lint
```

부가세 분리 로직(`splitSupplyVat`)은 반드시 **합계 보존 불변식**
(`supply + vat === total`)을 지키도록 `lib/vat.test.ts`에서 경계값
14+개를 검증합니다. 이 로직을 수정할 때는 반드시 테스트를 먼저 돌려주세요.

## 8. 주의사항 (세무 관점)

- **장부 데이터는 localStorage에만 저장됩니다.** 브라우저 캐시 삭제 또는 시크릿 모드 만료 시 모두 사라집니다. 정기적으로 CSV로 내보내 백업하세요. 장기 운영용으로는 DB(Supabase/Postgres 등)로 이전하세요.
- **간편장부 CSV는 "세무사 전달용" 또는 "엑셀 참고용"입니다.** 홈택스 전자신고에 직접 업로드되는 파일 포맷이 아닙니다. 실제 신고 시에는 세무사 또는 홈택스 안내에 따라 변환하세요.
- **AI 파싱 결과는 반드시 사람이 확인 후 저장하세요.** Whisper·Claude 모두 오인식이 있습니다. 음성·이미지 원본을 별도 보관하면 추후 분쟁 시 확인이 가능합니다. 세무상 증빙 보관 의무는 5년입니다.
- **세무 일정(부가세·종소세)은 `lib/date.ts`의 `upcomingTaxDeadlines()` 에서 동적 계산**되지만, 토·일·공휴일에 의한 영업일 연장까지는 반영하지 않습니다. 정확한 마감일은 국세청 홈택스를 확인하세요.
- **API 키는 서버 라우트에서만 사용**되며 클라이언트 번들에 포함되지 않습니다. `NEXT_PUBLIC_*` 접두사를 붙이지 마세요.
- **음성 입력은 HTTPS 필수**입니다 (Vercel 기본 제공, 로컬은 `localhost`).

## 9. 알려진 제한

- **단일 기기 전용** — 브라우저 1대 = 계정 1개. 인증·멀티 디바이스 동기화 없음.
- **`/api/*` 라우트에 레이트리밋 없음** — 배포 URL이 공개되면 API 비용 폭탄 위험. 운영 시 `@upstash/ratelimit` 등으로 IP 기반 제한을 걸거나, Vercel Password Protection 등으로 접근을 제한하세요.
- **부산 사투리 인식률**은 Whisper 기본 성능에 도메인 prompt 힌트를 얹은 수준이며, 표준어 대비 여전히 낮습니다. 중요한 거래는 수정 가능성을 전제로 확인 후 저장하세요.

