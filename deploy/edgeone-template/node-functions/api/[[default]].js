import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();

const CORRECT_PAIR = ['connectorPort', 'longTubePort'];
const CORRECT_PATIENT_PORT = 'shortTubePort';

const store = globalThis.__OPENCLAW_EDGEONE_STORE__ ?? {
  sessions: [],
  submissions: [],
};

globalThis.__OPENCLAW_EDGEONE_STORE__ = store;

app.use(cors());
app.use(express.json());

function summarize() {
  const correctCount = store.submissions.filter((item) => item.isCorrect).length;
  const incorrectCount = store.submissions.length - correctCount;
  const accuracy =
    store.submissions.length === 0
      ? 0
      : Number(((correctCount / store.submissions.length) * 100).toFixed(1));

  const recentAttempts = [...store.submissions]
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
    totalSubmissions: store.submissions.length,
    accuracy,
    recentAttempts,
  };
}

function normalizePair(portIds) {
  return [...portIds].sort().join('|');
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, runtime: 'edgeone-node-function' });
});

app.get('/stats', (_req, res) => {
  res.json(summarize());
});

app.post('/stats/reset', (_req, res) => {
  store.sessions.length = 0;
  store.submissions.length = 0;
  res.json(summarize());
});

app.post('/game/start', (req, res) => {
  const playerName = String(req.body?.playerName || '匿名同学').trim() || '匿名同学';
  const source = String(req.body?.source || 'web').trim() || 'web';

  const session = {
    id: randomUUID(),
    playerName,
    source,
    startedAt: new Date().toISOString(),
  };

  store.sessions.push(session);

  res.status(201).json({
    sessionId: session.id,
    playerName: session.playerName,
    startedAt: session.startedAt,
  });
});

app.post('/game/submit', (req, res) => {
  const sessionId = String(req.body?.sessionId || '');
  const source = String(req.body?.source || 'web').trim() || 'web';
  const playerName = String(req.body?.playerName || '匿名同学').trim() || '匿名同学';
  const answer = req.body?.answer;

  if (!sessionId) {
    return res.status(400).json({ message: '缺少 sessionId。' });
  }

  if (!answer?.firstPortId || !answer?.secondPortId || !answer?.patientPortId) {
    return res.status(400).json({ message: '请先完成两步接管：先连接排气口和水封管接口，再接引流病人的管。' });
  }

  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) {
    return res.status(404).json({ message: '未找到对应对局，请重新开始。' });
  }

  if (session.submittedAt) {
    return res.status(409).json({ message: '该对局已经提交，请重新开始新一局。' });
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

  session.playerName = playerName;
  session.submittedAt = submittedAt;
  store.submissions.push(submission);

  return res.json({
    result: {
      ...submission,
      startedAt: session.startedAt,
    },
    stats: summarize(),
  });
});

export default app;
