import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit } from "@/lib/ratelimit";
import { CLAUDE_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

// ───── 설정 ─────
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — Vision API 비용 상한
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Mode = "handwriting" | "receipt" | "taxinvoice";

// ───── Anthropic lazy init ─────
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

// ───── 모드별 tool schema (structured output) ─────
const TOOLS: Record<Mode, Anthropic.Tool> = {
  handwriting: {
    name: "record_handwriting_entries",
    description:
      "손글씨 장부 이미지에서 거래 항목들을 추출합니다. " +
      "판독할 수 없으면 items를 빈 배열로 호출하고 unreadable을 true로 설정하세요.",
    input_schema: {
      type: "object",
      properties: {
        unreadable: {
          type: "boolean",
          description: "이미지가 판독 불가능하면 true",
        },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD (월/일만 있으면 올해 기준)" },
              account: { type: "string", description: "계정과목" },
              description: { type: "string" },
              vendor: { type: "string" },
              type: { type: "string", enum: ["in", "out"] },
              total: { type: "number", description: "합계금액 (원)" },
              confidence: { type: "number", description: "0.0~1.0 이 항목의 신뢰도" },
            },
            required: ["account", "description", "type", "total"],
          },
        },
      },
      required: ["items"],
    },
  },
  receipt: {
    name: "record_receipt",
    description:
      "인쇄된 한국 영수증에서 정보를 추출합니다. " +
      "판독할 수 없으면 unreadable을 true로 설정하세요.",
    input_schema: {
      type: "object",
      properties: {
        unreadable: { type: "boolean" },
        vendor: { type: "string", description: "상호" },
        date: { type: "string", description: "YYYY-MM-DD" },
        account: {
          type: "string",
          enum: ["식재료비", "공과금", "소모품비", "통신비", "임차료", "접대비", "기타"],
        },
        description: { type: "string" },
        supply: {
          type: "number",
          description: "공급가액. 영수증에 분리 표시되어 있을 때만. 아니면 0.",
        },
        vat: { type: "number", description: "부가세. 분리 표시되어 있을 때만. 아니면 0." },
        total: { type: "number", description: "합계금액 (필수)" },
        evidence: {
          type: "string",
          enum: ["cash_receipt", "card", "simple_receipt"],
        },
        confidence: { type: "number" },
      },
      required: ["total"],
    },
  },
  taxinvoice: {
    name: "record_tax_invoice",
    description: "한국 세금계산서 이미지에서 정보를 추출합니다.",
    input_schema: {
      type: "object",
      properties: {
        unreadable: { type: "boolean" },
        vendor: { type: "string", description: "공급자 상호" },
        date: { type: "string", description: "작성일자 YYYY-MM-DD" },
        description: { type: "string", description: "품목 요약" },
        supply: { type: "number", description: "공급가액" },
        vat: { type: "number", description: "부가세 (보통 공급가액의 10%)" },
        total: { type: "number", description: "합계금액" },
        type: {
          type: "string",
          enum: ["buy", "sell"],
          description: "매입이면 buy, 매출이면 sell",
        },
        confidence: { type: "number" },
      },
      required: ["supply", "vat", "total"],
    },
  },
};

const PROMPTS: Record<Mode, string> = {
  handwriting:
    "이 이미지는 한국어 손글씨로 작성된 장부입니다. " +
    "모든 거래 항목을 추출해 record_handwriting_entries 도구를 호출하세요. " +
    "매출/수입은 type='in', 매입/지출은 type='out'으로 분류하세요. " +
    "손글씨 장부는 보통 증빙이 없으므로 evidence 정보는 비워도 됩니다.",
  receipt:
    "이 이미지는 인쇄된 한국 영수증입니다. " +
    "record_receipt 도구를 호출해 정보를 기록하세요. " +
    "부가세가 영수증에 분리 표시되지 않았다면 supply와 vat를 0으로 두고 total만 채우세요.",
  taxinvoice:
    "이 이미지는 한국 세금계산서입니다. " +
    "record_tax_invoice 도구를 호출해 정보를 기록하세요. " +
    "매입/매출 구분이 불분명하면 buy로 기본 설정하세요.",
};

// ───── 에러 메시지 매핑 ─────
function userFriendlyError(err: any): { message: string; status: number } {
  const raw = String(err?.message || err || "");
  if (raw.includes("ANTHROPIC_API_KEY")) {
    return { message: "서버 설정 오류입니다. 관리자에게 문의하세요.", status: 500 };
  }
  if (raw.includes("rate limit") || raw.includes("429")) {
    return { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", status: 429 };
  }
  if (raw.toLowerCase().includes("timeout")) {
    return { message: "처리 시간이 초과됐습니다. 다시 시도해주세요.", status: 504 };
  }
  return { message: "이미지 분석에 실패했습니다. 더 선명한 사진으로 다시 시도해주세요.", status: 500 };
}

// ───── 라우트 핸들러 ─────
export async function POST(req: NextRequest) {
  try {
    // 레이트리밋
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const deviceId = req.headers.get("x-device-id") || undefined;
    const rl = await checkRateLimit(ip, deviceId);
    if (!rl.ok) {
      return NextResponse.json({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const mode = (formData.get("mode") as Mode) || "receipt";

    // 입력 검증
    if (!file) {
      return NextResponse.json({ error: "image 파일이 필요합니다" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "빈 파일입니다" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다 (최대 ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` },
        { status: 413 }
      );
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `지원하지 않는 이미지 형식입니다: ${file.type || "(unknown)"}` },
        { status: 415 }
      );
    }
    if (!["handwriting", "receipt", "taxinvoice"].includes(mode)) {
      return NextResponse.json({ error: "잘못된 mode" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const anthropic = getAnthropic();

    // ───── 손글씨 모드: 네이버 클로바 OCR → Claude 구조화 ─────
    if (mode === "handwriting") {
      const clovaUrl = process.env.CLOVA_OCR_URL;
      const clovaSecret = process.env.CLOVA_OCR_SECRET;

      let ocrText = "";
      if (clovaUrl && clovaSecret) {
        try {
          const clovaBody = {
            version: "V2",
            requestId: Date.now().toString(),
            timestamp: Date.now(),
            lang: "ko",
            images: [{ format: file.type.split("/")[1] || "jpg", data: base64, name: "img" }],
          };
          const clovaRes = await fetch(clovaUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-OCR-SECRET": clovaSecret },
            body: JSON.stringify(clovaBody),
          });
          const clovaData = await clovaRes.json();
          const fields = clovaData?.images?.[0]?.fields ?? [];
          ocrText = fields.map((f: any) => f.inferText).join(" ");
        } catch (e) {
          console.warn("[clova ocr] fallback to vision:", e);
        }
      }

      if (ocrText.trim()) {
        // 클로바 OCR 텍스트를 Claude에게 구조화 요청
        const msg = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          tools: [TOOLS.handwriting],
          tool_choice: { type: "tool", name: TOOLS.handwriting.name },
          messages: [
            {
              role: "user",
              content: `다음은 한국어 손글씨 장부를 OCR로 추출한 텍스트입니다:\n\n${ocrText}\n\n이 텍스트에서 거래 항목들을 추출해 record_handwriting_entries 도구를 호출하세요.`,
            },
          ],
        });
        const toolUse = msg.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
        const input = (toolUse?.input ?? null) as any;
        if (!input || input.unreadable) return NextResponse.json({ mode, result: null, unreadable: true });
        return NextResponse.json({ mode, result: input.items ?? [] });
      }
      // 클로바 미설정 또는 실패 시 기존 Vision 방식으로 fallback
    }

    // ───── 기본: Claude Vision 직접 호출 ─────
    const msg = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      tools: [TOOLS[mode]],
      tool_choice: { type: "tool", name: TOOLS[mode].name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: PROMPTS[mode] },
          ],
        },
      ],
    });

    const toolUse = msg.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
    );
    const input = (toolUse?.input ?? null) as any;

    // 판독 실패 처리
    if (!input || input.unreadable) {
      return NextResponse.json({ mode, result: null, unreadable: true });
    }

    // handwriting은 items 배열, 나머지는 단일 객체를 반환
    const result = mode === "handwriting" ? input.items ?? [] : input;
    return NextResponse.json({ mode, result });
  } catch (err: any) {
    console.error("[/api/ocr] error:", err);
    const { message, status } = userFriendlyError(err);
    return NextResponse.json({ error: message }, { status });
  }
}
