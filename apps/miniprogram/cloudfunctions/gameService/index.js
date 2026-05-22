const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const submissionsCollection = db.collection('openclaw_submissions');

const CORRECT_PAIR = ['connectorPort', 'longTubePort'];
const CORRECT_PATIENT_PORT = 'shortTubePort';

function normalizePair(portIds) {
  return [...portIds].sort().join('|');
}

async function summarize() {
  const result = await submissionsCollection.orderBy('submittedAt', 'desc').get().catch(() => ({
    data: [],
  }));
  const submissions = result.data || [];
  const correctCount = submissions.filter((item) => item.isCorrect).length;
  const incorrectCount = submissions.length - correctCount;
  const accuracy =
    submissions.length === 0 ? 0 : Number(((correctCount / submissions.length) * 100).toFixed(1));

  return {
    correctCount,
    incorrectCount,
    totalSubmissions: submissions.length,
    accuracy,
    recentAttempts: submissions.slice(0, 8).map((item) => ({
      playerName: item.playerName,
      submittedAt: item.submittedAt,
      score: item.score,
      total: item.total,
      isCorrect: item.isCorrect,
    })),
  };
}

async function resetStats() {
  const result = await submissionsCollection.get().catch(() => ({ data: [] }));
  const submissions = result.data || [];

  await Promise.all(
    submissions.map((item) => submissionsCollection.doc(item._id).remove()),
  );

  return summarize();
}

exports.main = async (event) => {
  const action = event.action;

  if (action === 'getStats') {
    return summarize();
  }

  if (action === 'resetStats') {
    return resetStats();
  }

  if (action === 'startGame') {
    const playerName = String(event.playerName || '匿名同学').trim() || '匿名同学';
    return {
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      playerName,
      startedAt: new Date().toISOString(),
    };
  }

  if (action === 'submitGame') {
    const sessionId = String(event.sessionId || '');
    const playerName = String(event.playerName || '匿名同学').trim() || '匿名同学';
    const source = String(event.source || 'miniprogram').trim() || 'miniprogram';
    const answer = event.answer || {};

    if (!sessionId) {
      throw new Error('缺少 sessionId。');
    }

    if (!answer.firstPortId || !answer.secondPortId || !answer.patientPortId) {
      throw new Error('请先完成两步接管后再提交。');
    }

    const existing = await submissionsCollection.where({ sessionId }).limit(1).get().catch(() => ({
      data: [],
    }));
    if (existing.data && existing.data.length) {
      throw new Error('该对局已经提交，请重新开始新一局。');
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
      startedAt: event.startedAt || submittedAt,
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

    await submissionsCollection.add({
      data: submission,
    });

    return {
      result: submission,
      stats: await summarize(),
    };
  }

  throw new Error('未知 action。');
};
