const WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbyxCd2MigrGMDRU8Shbyzdmg3BrykyMgizgPyAqEEJ9q5wK-eppvLbYOTLbUVr1pSaYMQ/exec';

const SESSION_KEY = 'sessionId';

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface RunData {
  survivorId: number;
  survivorName: string;
  victory: boolean;
  combatReached: number;
  durationSeconds: number;
  speedKills: number;
  hpRecovered: number;
  finalHP: number;
  maxHP: number;
}

export function sendRunData(data: RunData): void {
  try {
    const body = JSON.stringify({
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      ...data,
    });

    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      mode: 'no-cors',
    }).catch(() => { /* silently ignore */ });
  } catch {
    // Telemetry must never break the game
  }
}
