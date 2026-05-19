import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { todayKST } from "@/lib/date";
import { checkRateLimit } from "@/lib/ratelimit";
import { CLAUDE_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// ───── 설정 ─────
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
];

// Whisper 프롬프트 힌트 — 부산 사투리와 회계 용어를 미리 알려주면 인식률이 올라갑니다.
const WHISPER_PROMPT =
  "부가세, 공급가액, 매출, 매입, 식재료비, 임차료, 통신비, 소모품비, 접대비, " +
  "현금영수증, 세금계산서, 간이영수증. " +
  "부산 사투리 장부 음성입니다: 나갔데이, 들어왔데이, 샀데이, 팔았데이, 만원, 천원.";

// ───── 클라이언트 lazy init ─────
// 모듈 레벨 초기화는 env 누락 시 런타임 import 시점에 터져 디버깅이 어렵습니다.
// 함수 호출 시 검증하면서 생성합니다.
let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// ───── Claude tool schema — 자유 텍스트 파싱 대신 structured output 강제 ─────
const RECORD_ENTRIES_TOOL: Anthropic.Tool = {
  name: "record_entries",
  description:
    "사용자 음성에서 추출한 장부 거래 항목들을 기록합니다. " +
    "거래 내역이 전혀 없으면 빈 배열을 넘기세요.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: "YYYY-MM-DD 형식. 명시되지 않으면 오늘 날짜.",
            },
            account: {
              type: "string",
              description:
                "계정과목 (식재료비, 매출, 공과금, 임차료, 통신비, 소모품비, 접대비, 기타 등)",
            },
            description: {
              type: "string",
              description: "짧은 거래 설명 (예: '고기 구입', '현금매출')",
            },
            vendor: {
              type: "string",
              description: "거래처명. 모르면 빈 문자열.",
            },
            type: {
              type: "string",
              enum: ["in", "out"],
              description: "수입이면 in, 비용이면 out",
            },
            total: {
              type: "number",
              description: "부가세 포함 합계금액 (원 단위 정수)",
            },
            evidence: {
              type: "string",
              enum: ["tax_invoice", "cash_receipt", "card", "simple_receipt", "none"],
              description: "증빙 종류. 명확하지 않으면 none.",
            },
            confidence: {
              type: "number",
              description: "0.0~1.0 사이의 이 항목에 대한 신뢰도",
            },
          },
          required: ["account", "description", "type", "total", "evidence"],
        },
      },
    },
    required: ["items"],
  },
};

const PARSE_SYSTEM = `당신은 한국어(부산 사투리 포함) 음성을 듣고 장부 항목을 추출하는 비서입니다.
사용자 문장에서 거래 내역을 찾아 반드시 record_entries 도구를 호출해 결과를 전달하세요.

규칙:
- 사용자가 부가세를 따로 말하지 않는 한 "total"에는 부가세 포함 합계만 넣으세요. (분리는 서버에서 합니다)
- 증빙 종류가 명확하지 않으면 "none"으로 두세요.
- 거래 내역이 전혀 없으면 items를 빈 배열로 호출하세요.
- 금액이 확실하지 않거나 단위가 애매하면(예: "삼만" vs "삼만원") confidence를 낮추세요.
- 날짜를 특정할 수 없으면 오늘 날짜를 사용하고, "어제"·"그제" 같은 상대 표현은 계산해서 채우세요.`;

// ───── 에러 메시지 매핑 — 내부 구현 유출 방지 ─────
function userFriendlyError(err: any): { message: string; status: number } {
  const raw = String(err?.message || err || "");
  if (raw.includes("ANTHROPIC_API_KEY") || raw.includes("OPENAI_API_KEY")) {
    return { message: "서버 설정 오류입니다. 관리자에게 문의하세요.", status: 500 };
  }
  if (raw.includes("rate limit") || raw.includes("429")) {
    return { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", status: 429 };
  }
  if (raw.toLowerCase().includes("timeout")) {
    return { message: "처리 시간이 초과됐습니다. 다시 시도해주세요.", status: 504 };
  }
  return { message: "음성 분석에 실패했습니다. 다시 시도해주세요.", status: 500 };
}

// ───── 라우트 핸들러 ─────
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(ip);
    if (!rl.ok) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("audio") as File | null;

    // 1) 입력 검증
    if (!file) {
      return NextResponse.json({ error: "audio 파일이 필요합니다" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "빈 파일입니다" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 ${MAX_AUDIO_BYTES / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }
    // MIME 타입 검증 — OCR과 동일 정책: 빈 값도 거부
    if (!file.type || !ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `지원하지 않는 오디오 형식입니다: ${file.type || "(unknown)"}` },
        { status: 415 }
      );
    }

    // 2) Whisper로 음성 → 텍스트 (도메인 힌트 prompt 포함)
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "ko",
      prompt: WHISPER_PROMPT,
    });
    const text = transcription.text;

    if (!text || !text.trim()) {
      return NextResponse.json({ text: "", items: [] });
    }

    // 3) Claude로 텍스트 → 장부 항목 (tool use로 structured output 강제)
    const anthropic = getAnthropic();
    const today = todayKST(); // KST 기준 — UTC 날짜 밀림 버그 방지

    // 상대 날짜를 서버에서 미리 계산 — LLM에게 맡기면 오프바이원 발생 가능
    const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const dateFmt = (d: Date) => d.toISOString().slice(0, 10);
    const daysAgo = (n: number) => { const d = new Date(kstNow); d.setDate(d.getDate() - n); return dateFmt(d); };
    const dateHints = `오늘=${today}, 어제=${daysAgo(1)}, 그제=${daysAgo(2)}, 그저께=${daysAgo(2)}, 엊그제=${daysAgo(2)}`;

    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: PARSE_SYSTEM,
      tools: [RECORD_ENTRIES_TOOL],
      tool_choice: { type: "tool", name: "record_entries" },
      messages: [
        {
          role: "user",
          content:
            `날짜 참고: ${dateHints}\n\n` +
            `다음 문장을 분석해 record_entries 도구를 호출하세요:\n"${text}"`,
        },
      ],
    });

    // tool_use 블록에서 바로 꺼냄 — JSON.parse 불필요, 정규식 매칭 불필요
    const toolUse = msg.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
    );
    const items = toolUse ? ((toolUse.input as any).items ?? []) : [];

    return NextResponse.json({ text, items });
  } catch (err: any) {
    console.error("[/api/transcribe] error:", err);
    const { message, status } = userFriendlyError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
