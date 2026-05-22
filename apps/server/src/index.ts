import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PortId = 'shortTubePort' | 'connectorPort' | 'longTubePort';

type StoredSession = {
  id: string;
  playerName: string;
  source: string;
  startedAt: string;
  submittedAt?: string;
};

type SubmittedAnswer = {
  firstPortId: PortId;
  secondPortId: PortId;
  patientPortId: PortId;
};

type Submission = {
  sessionId: string;
  playerName: string;
  source: string;
  submittedAt: string;
  answer: SubmittedAnswer;
  score: number;
  total: number;
  isCorrect: boolean;
  details: Array<{
    selectedPortIds: PortId[];
    correctPortIds: PortId[];
    selectedPatientPortId: PortId;
    correctPatientPortId: PortId;
    pairIsCorrect: boolean;
    patientTubeIsCorrect: boolean;
    isCorrect: boolean;
  }>;
};

type Store = {
  sessions: StoredSession[];
  submissions: Submission[];
};

const CORRECT_PAIR: [PortId, PortId] = ['connectorPort', 'longTubePort'];
const CORRECT_PATIENT_PORT: PortId = 'shortTubePort';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_FILE = path.join(DATA_DIR, 'results.json');
const H5_DIST_DIR = path.resolve(__dirname, '../../h5/dist');
const H5_INDEX_FILE = path.join(H5_DIST_DIR, 'index.html');

const app = express();
app.use(cors());
app.use(express.json());

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_FILE, 'utf8');
  } catch {
    const initialStore: Store = { sessions: [], submissions: [] };
    await writeFile(STORE_FILE, JSON.stringify(initialStore, null, 2), 'utf8');
  }
}

async function readStore(): Promise<Store> {
  await ensureStore();
  const raw = await readFile(STORE_FILE, 'utf8');
  return JSON.parse(raw) as Store;
}

async function writeStore(store: Store) {
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function summarize(store: Store) {
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

function normalizePair(portIds: PortId[]) {
  return [...portIds].sort().join('|');
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/stats', async (_req, res) => {
  const store = await readStore();
  res.json(summarize(store));
});

app.post('/api/stats/reset', async (_req, res) => {
  const emptyStore: Store = {
    sessions: [],
    submissions: [],
  };

  await writeStore(emptyStore);
  res.json(summarize(emptyStore));
});

app.post('/api/game/start', async (req, res) => {
  const store = await readStore();
  const playerName = String(req.body?.playerName || '匿名同学').trim() || '匿名同学';
  const source = String(req.body?.source || 'web').trim() || 'web';
  const session: StoredSession = {
    id: randomUUID(),
    playerName,
    source,
    startedAt: new Date().toISOString(),
  };

  store.sessions.push(session);
  await writeStore(store);

  res.status(201).json({
    sessionId: session.id,
    playerName: session.playerName,
    startedAt: session.startedAt,
  });
});

app.post('/api/game/submit', async (req, res) => {
  const store = await readStore();
  const sessionId = String(req.body?.sessionId || '');
  const source = String(req.body?.source || 'web').trim() || 'web';
  const playerName = String(req.body?.playerName || '匿名同学').trim() || '匿名同学';
  const answer = req.body?.answer as Partial<SubmittedAnswer> | undefined;

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

  const selectedPortIds = [answer.firstPortId, answer.secondPortId] as PortId[];
  const pairIsCorrect = normalizePair(selectedPortIds) === normalizePair(CORRECT_PAIR);
  const patientTubeIsCorrect = answer.patientPortId === CORRECT_PATIENT_PORT;
  const isCorrect = pairIsCorrect && patientTubeIsCorrect;
  const submittedAt = new Date().toISOString();

  const submission: Submission = {
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
  await writeStore(store);

  res.json({
    result: {
      ...submission,
      startedAt: session.startedAt,
    },
    stats: summarize(store),
  });
});

if (existsSync(H5_DIST_DIR)) {
  app.use(express.static(H5_DIST_DIR));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(H5_INDEX_FILE);
  });
}

const port = Number(process.env.PORT || 3001);
ensureStore()
  .then(() => {
    app.listen(port, () => {
      console.log(`Stats API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize store', error);
    process.exit(1);
  });
