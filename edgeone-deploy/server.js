// =====================================================================
//  OpenClaw - 边缘函数判定服务（无状态版）
//
//  背景：阿里云 ESA Pages Function 的运行环境是 V8 Isolate，相邻请求
//  可能落到不同节点 / 不同 isolate 上，所以"用 globalThis 缓存会话"
//  在边缘是不可靠的——start 和 submit 落不到同一个 isolate 就会出现
//  "未找到对应对局" 的报错。
//
//  这一版改造为无状态：
//    1. /api/game/start  只生成 sessionId & startedAt 直接返回，
//       不再在服务端持有会话。
//    2. /api/game/submit 不校验 session 是否存在，直接根据 answer 判定，
//       提交记录仍存到本节点的内存里，用 sessionId 兜底去重。
//    3. /api/stats / /api/stats/reset 仍读本节点内存，因此跨节点统计
//       不互通——这是无状态方案的已知折衷。如果以后需要全班统计强一致，
//       接 ESA Edge KV 即可：把 readSubmissions / writeSubmission 换成
//       KV API，其它逻辑不动。
// =====================================================================

const CORRECT_PAIR = ["connectorPort", "longTubePort"];
const CORRECT_PATIENT_PORT = "shortTubePort";

// 本节点内存里的提交记录。仅用于"看得见的最近提交"展示，
// 跨节点不互通——这是无状态方案的有意取舍。
const localStore = globalThis.__OPENCLAW_ESA_STORE__ ?? {
  submissions: [],
  submittedSessionIds: new Set(),
};

globalThis.__OPENCLAW_ESA_STORE__ = localStore;

const MAX_SUBMISSIONS_KEPT = 200; // 避免长期运行下内存无限增长

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "no-store",
};

function json(data, init = {}) {
  const { headers = {}, status = 200 } = init;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...baseHeaders,
      ...headers,
    },
  });
}

function empty(status = 204) {
  return new Response(null, { status, headers: baseHeaders });
}

function normalizePair(portIds) {
  return [...portIds].sort().join("|");
}

function summarize() {
  const submissions = localStore.submissions;
  const correctCount = submissions.filter((item) => item.isCorrect).length;
  const incorrectCount = submissions.length - correctCount;
  const accuracy =
    submissions.length === 0
      ? 0
      : Number(((correctCount / submissions.length) * 100).toFixed(1));

  const recentAttempts = [...submissions]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 8)
    .map((item) => ({
      playerName: item.playerName,
      submittedAt: item.submittedAt,
      score: item.score,
      total: item.total,
      isCorrect: item.isCorrect,
    }));

  return {
    correctCount,
    incorrectCount,
    totalSubmissions: submissions.length,
    accuracy,
    recentAttempts,
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function newSessionId() {
  // crypto.randomUUID 在 ESA 边缘函数里可用；保留兜底以防特定运行时缺失。
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function handleRequest(request) {
  if (request.method === "OPTIONS") {
    return empty();
  }

  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, runtime: "aliyun-esa-pages", mode: "stateless" });
  }

  if (pathname === "/api/stats" && request.method === "GET") {
    return json(summarize());
  }

  if (pathname === "/api/stats/reset" && request.method === "POST") {
    localStore.submissions.length = 0;
    localStore.submittedSessionIds.clear();
    return json(summarize());
  }

  // ---------------- /api/game/start ----------------
  // 不再保存到服务端；客户端拿着 sessionId / startedAt 走完整局。
  if (pathname === "/api/game/start" && request.method === "POST") {
    const body = await readJson(request);
    const playerName = String(body?.playerName || "匿名同学").trim() || "匿名同学";

    return json(
      {
        sessionId: newSessionId(),
        playerName,
        startedAt: new Date().toISOString(),
      },
      { status: 201 },
    );
  }

  // ---------------- /api/game/submit ----------------
  // 信任客户端传来的 sessionId / playerName / startedAt（可选），
  // 直接根据 answer 判定，不再校验 session 是否在服务端存在。
  if (pathname === "/api/game/submit" && request.method === "POST") {
    const body = await readJson(request);
    const sessionId = String(body?.sessionId || "");
    const source = String(body?.source || "web").trim() || "web";
    const playerName = String(body?.playerName || "匿名同学").trim() || "匿名同学";
    const answer = body?.answer;
    // 客户端如果传了 startedAt 就用它，没传就回退到当前时间，让前端展示不至于空。
    const startedAt =
      typeof body?.startedAt === "string" && body.startedAt
        ? body.startedAt
        : new Date().toISOString();

    if (!sessionId) {
      return json({ message: "缺少 sessionId，请重新开始本轮。" }, { status: 400 });
    }

    if (!answer?.firstPortId || !answer?.secondPortId || !answer?.patientPortId) {
      return json(
        { message: "请先完成两步接管：先接连接管，再接引流管。" },
        { status: 400 },
      );
    }

    // 同节点内防止同一局重复提交；跨节点的重复只能由前端控制（提交后按钮 disabled）。
    if (localStore.submittedSessionIds.has(sessionId)) {
      return json(
        { message: "该对局已经提交，请重新开始新一局。" },
        { status: 409 },
      );
    }

    const selectedPortIds = [answer.firstPortId, answer.secondPortId];
    const pairIsCorrect = normalizePair(selectedPortIds) === normalizePair(CORRECT_PAIR);
    const patientTubeIsCorrect = answer.patientPortId === CORRECT_PATIENT_PORT;
    const isCorrect = pairIsCorrect && patientTubeIsCorrect;
    const submittedAt = new Date().toISOString();

    const submission = {
      sessionId,
      playerName,
      source,
      startedAt,
      submittedAt,
      answer: {
        firstPortId: answer.firstPortId,
        secondPortId: answer.secondPortId,
        patientPortId: answer.patientPortId,
      },
      score: isCorrect ? 1 : 0,
      total: 1,
      isCorrect,
      details: [
        {
          selectedPortIds,
          correctPortIds: [...CORRECT_PAIR],
          selectedPatientPortId: answer.patientPortId,
          correctPatientPortId: CORRECT_PATIENT_PORT,
          pairIsCorrect,
          patientTubeIsCorrect,
          isCorrect,
        },
      ],
    };

    localStore.submissions.push(submission);
    localStore.submittedSessionIds.add(sessionId);

    // 防止本节点内存无限增长——超量后丢掉最早的几条。
    if (localStore.submissions.length > MAX_SUBMISSIONS_KEPT) {
      const removed = localStore.submissions.splice(
        0,
        localStore.submissions.length - MAX_SUBMISSIONS_KEPT,
      );
      for (const item of removed) {
        localStore.submittedSessionIds.delete(item.sessionId);
      }
    }

    return json({
      result: {
        ...submission,
      },
      stats: summarize(),
    });
  }

  return json({ message: "Not Found" }, { status: 404 });
}

export default {
  fetch(request) {
    return handleRequest(request);
  },
};
