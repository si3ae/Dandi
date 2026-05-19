import { uuid } from "./uuid";
/**
 * 클라이언트 ↔ 서버 동기화
 *
 * 원칙:
 *   - localStorage가 항상 1차 저장소 (오프라인 동작 보장)
 *   - Supabase가 있으면 백그라운드로 push/pull (데이터 유실 방지)
 *   - 기기 변경 시 pull로 복원 가능
 *
 * deviceId: 최초 접속 시 uuid()로 생성, localStorage에 저장.
 *           사용자 계정 없이 기기 단위 격리.
 */

const DEVICE_KEY = "dandi_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function syncRequest(body: any): Promise<any> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), ...body }),
    });
    if (!res.ok) {
      // 503 = DB 미설정 → 무시 (localStorage 모드)
      if (res.status === 503) return null;
      console.warn("[sync] 실패:", res.status);
      return null;
    }
    return res.json();
  } catch {
    // 오프라인 → 무시
    return null;
  }
}

/**
 * localStorage 데이터를 서버에 백업 (push)
 * 장부 추가/수정/삭제 후 호출
 */
export async function pushEntries(entries: any[]) {
  return syncRequest({ action: "push", table: "entries", data: entries });
}

export async function pushVendors(vendors: any[]) {
  return syncRequest({ action: "push", table: "vendors", data: vendors });
}

export async function pushSettings(settings: any) {
  return syncRequest({ action: "push", table: "settings", data: settings });
}

/**
 * 서버에서 데이터 가져오기 (pull)
 * 앱 최초 로드 시 또는 기기 변경 시 호출
 */
export async function pullEntries(): Promise<any[] | null> {
  const res = await syncRequest({ action: "pull", table: "entries" });
  return res?.data || null;
}

export async function pullVendors(): Promise<any[] | null> {
  const res = await syncRequest({ action: "pull", table: "vendors" });
  return res?.data || null;
}

export async function pullSettings(): Promise<any | null> {
  const res = await syncRequest({ action: "pull", table: "settings" });
  return res?.data || null;
}

/**
 * 앱 시작 시 동기화
 * - 서버에 데이터가 있고 로컬이 비어있으면 → pull (기기 변경 복원)
 * - 로컬에 데이터가 있으면 → push (백업)
 */
export async function syncOnLoad(
  localEntries: any[],
  localVendors: any[],
  onRestored?: (entries: any[], vendors: any[]) => void
) {
  // 서버 데이터 확인
  const serverEntries = await pullEntries();

  if (serverEntries === null) {
    // DB 미설정 또는 오프라인 → 스킵
    return;
  }

  if (localEntries.length === 0 && serverEntries.length > 0) {
    // 로컬 비어있고 서버에 있음 → 복원
    const serverVendors = await pullVendors();
    if (onRestored) {
      onRestored(serverEntries, serverVendors || []);
    }
    return;
  }

  // 로컬에 데이터 있음 → 서버에 백업
  if (localEntries.length > 0) {
    await pushEntries(localEntries);
  }
  if (localVendors.length > 0) {
    await pushVendors(localVendors);
  }
}
