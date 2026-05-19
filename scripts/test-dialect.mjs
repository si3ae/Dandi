/**
 * 부산 사투리 음성 테스트 스크립트
 * 
 * 사용법:
 *   node test-dialect.mjs [wav파일경로1] [wav파일경로2] ...
 * 
 * 예시:
 *   node test-dialect.mjs st_set3_collectorgs25_speakergs207_25_10.wav st_set3_collectorgs25_speakergs207_27_9.wav
 * 
 * 필요:
 *   .env.local에 OPENAI_API_KEY, ANTHROPIC_API_KEY 설정
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// .env.local 읽기
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PARSE_SYSTEM = `당신은 한국어(부산 사투리 포함) 음성 전사 텍스트를 분석하는 비서입니다.
문장에서 거래 내역이 있으면 JSON 배열로 추출하세요. 거래 내역이 아닌 일반 대화면 빈 배열 []을 반환하세요.
다른 설명은 쓰지 마세요.

각 항목:
{
  "description": "거래내용",
  "type": "in" | "out",
  "total": number,
  "account": "계정과목"
}`;

async function testFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📁 파일: ${fileName}`);
  console.log(`${"=".repeat(60)}`);

  // Step 1: Whisper 전사
  console.log("\n🎤 [Step 1] Whisper 음성 인식...");
  const fileStream = fs.createReadStream(filePath);
  const transcription = await openai.audio.transcriptions.create({
    file: fileStream,
    model: "whisper-1",
    language: "ko",
  });
  console.log(`   전사 결과: "${transcription.text}"`);

  // Step 2: Claude 파싱
  console.log("\n🤖 [Step 2] Claude 장부 항목 파싱...");
  const today = new Date().toISOString().slice(0, 10);
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    system: PARSE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `다음 문장을 분석하세요:\n"${transcription.text}"`,
      },
    ],
  });

  const raw = msg.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();

  let entries = [];
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      entries = JSON.parse(jsonMatch[0]);
    } catch {}
  }

  if (entries.length > 0) {
    console.log("   ✅ 장부 항목 발견:");
    entries.forEach((e, i) => {
      console.log(
        `      ${i + 1}. ${e.description} | ${e.type === "in" ? "수입" : "지출"} | ${(e.total || 0).toLocaleString()}원 | ${e.account || "기타"}`
      );
    });
  } else {
    console.log("   ℹ️  거래 내역 없음 (일반 대화)");
  }

  return { fileName, text: transcription.text, entries };
}

// 메인
const files = process.argv.slice(2);
if (files.length === 0) {
  console.log("사용법: node test-dialect.mjs <wav파일1> [wav파일2] ...");
  process.exit(1);
}

console.log("🐔 단디 사투리 음성 테스트");
console.log(`   파일 수: ${files.length}`);

const results = [];
for (const f of files) {
  if (!fs.existsSync(f)) {
    console.log(`⚠ 파일 없음: ${f}`);
    continue;
  }
  try {
    const r = await testFile(f);
    results.push(r);
  } catch (e) {
    console.log(`❌ 에러: ${e.message}`);
  }
}

console.log(`\n\n${"=".repeat(60)}`);
console.log("📊 전체 결과 요약");
console.log(`${"=".repeat(60)}`);
results.forEach((r) => {
  console.log(`\n  ${r.fileName}`);
  console.log(`  → Whisper: "${r.text}"`);
  console.log(`  → 장부 항목: ${r.entries.length}건`);
});
