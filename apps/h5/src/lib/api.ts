import type { GameResult, GameStats, SubmittedConnectionAnswer } from '../types/game';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function withPreviewToken(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }

  const currentParams = new URLSearchParams(window.location.search);
  const eoToken = currentParams.get('eo_token');
  const eoTime = currentParams.get('eo_time');

  if (!eoToken || !eoTime) {
    return path;
  }

  const [pathname, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.set('eo_token', eoToken);
  params.set('eo_time', eoTime);

  return `${pathname}?${params.toString()}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${withPreviewToken(path)}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    const message = await response
      .json()
      .then((payload) => payload.message as string | undefined)
      .catch(() => undefined);
    throw new Error(message || '请求失败，请稍后重试。');
  }

  return (await response.json()) as T;
}

export function fetchStats() {
  return request<GameStats>('/api/stats');
}

export function resetStats() {
  return request<GameStats>('/api/stats/reset', {
    method: 'POST',
  });
}

export function startSession(payload: { playerName: string; source: string }) {
  return request<{ sessionId: string; playerName: string; startedAt: string }>(
    '/api/game/start',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function submitSession(payload: {
  sessionId: string;
  playerName: string;
  source: string;
  answer: SubmittedConnectionAnswer;
}) {
  return request<{ result: GameResult; stats: GameStats }>('/api/game/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
