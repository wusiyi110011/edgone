import { useEffect, useState } from 'react';
import './App.css';
import { DrainageModelViewer } from './components/DrainageModelViewer';
import footGaIcon from './assets/beian/foot-ga.png';
import footIcpIcon from './assets/beian/foot-icp.png';
import { fetchStats, resetStats, startSession, submitSession } from './lib/api';
import type {
  ConnectionAnswer,
  GameResult,
  GameStats,
  HotspotId,
  SubmittedConnectionAnswer,
} from './types/game';

const SEARCH_PARAMS = new URLSearchParams(window.location.search);
const INITIAL_NAME =
  SEARCH_PARAMS.get('playerName') || SEARCH_PARAMS.get('name') || '';
const GAME_SOURCE = SEARCH_PARAMS.get('from') === 'miniprogram' ? 'miniprogram' : 'web';
const PLAYER_NAME_STORAGE_KEY = 'openclaw-player-name';
type SiteRecord = {
  iconSrc: string;
  iconAlt: string;
  href: string;
  label: string;
  ariaLabel?: string;
};

const ICP_RECORD: SiteRecord = {
  iconSrc: footIcpIcon,
  iconAlt: 'ICP备案图标',
  href: 'https://beian.miit.gov.cn/#/Integrated/index',
  label: '闽ICP备2026011172号-1',
};
const PUBLIC_SECURITY_RECORD: SiteRecord = {
  iconSrc: footGaIcon,
  iconAlt: '公安备案图标',
  href: 'https://beian.mps.gov.cn/#/query/webSearch?code=35018302000338',
  label: '闽公网安备35018302000338号',
  ariaLabel: '公安备案信息',
};
const SITE_RECORDS: SiteRecord[] = [ICP_RECORD, PUBLIC_SECURITY_RECORD];

const EMPTY_ANSWER: ConnectionAnswer = {
  firstPortId: null,
  secondPortId: null,
  patientPortId: null,
};

function getInitialPlayerName() {
  if (INITIAL_NAME) {
    return INITIAL_NAME;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
}

function describePort(portId: HotspotId | null) {
  switch (portId) {
    case 'shortTubePort':
      return '引流管接口';
    case 'connectorPort':
      return '排气口';
    case 'longTubePort':
      return '水封管接口';
    default:
      return '未选择';
  }
}

function getPrompt(answer: ConnectionAnswer, result: GameResult | null) {
  if (result) {
    return result.isCorrect ? '连接正确，结果已记录。' : '连接错误，可以重新开始新一轮。';
  }
  if (!answer.firstPortId) {
    return '练习分两步：先接连接管，再接引流管。点击第一个接口后连接管才会出现。';
  }
  if (!answer.secondPortId) {
    return '请继续完成“先接连接管”，再点击另一个接口完成这一步。';
  }
  if (!answer.patientPortId) {
    return '请完成“再接引流管”，点击剩下的那个孔，为它接上一根引流管。';
  }
  return '两步接管都已完成，可以提交判定。';
}

function App() {
  const [playerName, setPlayerName] = useState(getInitialPlayerName);
  const [entryName, setEntryName] = useState(getInitialPlayerName);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [answer, setAnswer] = useState<ConnectionAnswer>(EMPTY_ANSWER);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [statusText, setStatusText] = useState('进入页面后先输入姓名，再开始挑战。练习分两步：先接连接管，再接引流管。');
  const [errorText, setErrorText] = useState('');
  const [entryErrorText, setEntryErrorText] = useState('');
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [introOpen, setIntroOpen] = useState(true);

  async function loadStats() {
    setStatsLoading(true);
    try {
      const nextStats = await fetchStats();
      setStats(nextStats);
    } catch (error) {
      setErrorText((error as Error).message);
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    document.body.style.overflow = introOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [introOpen]);

  async function handleStart(nextName = entryName) {
    const finalName = nextName.trim();
    if (!finalName) {
      setEntryErrorText('请输入姓名后再开始挑战。');
      setStatusText('请输入姓名后再开始挑战。');
      return;
    }

    setStarting(true);
    setEntryErrorText('');
    setErrorText('');
    setResult(null);

    try {
      const session = await startSession({
        playerName: finalName,
        source: GAME_SOURCE,
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, session.playerName);
      }

      setPlayerName(session.playerName);
      setEntryName(session.playerName);
      setSessionId(session.sessionId);
      setStartedAt(session.startedAt);
      setAnswer(EMPTY_ANSWER);
      setIntroOpen(false);
      setStatusText(`欢迎 ${session.playerName}，请先接连接管，再接引流管。`);
    } catch (error) {
      setEntryErrorText((error as Error).message);
    } finally {
      setStarting(false);
    }
  }

  function openIntroGate() {
    setEntryName(playerName);
    setEntryErrorText('');
    setIntroOpen(true);
  }

  function handlePortSelect(portId: HotspotId) {
    if (!sessionId) {
      setStatusText('请先开始挑战，再进行接管。');
      return;
    }

    if (result) {
      return;
    }

    setAnswer((current) => {
      if (!current.firstPortId) {
        setStatusText('已选第一步起点，连接管已出现。请继续完成“先接连接管”。');
        return {
          firstPortId: portId,
          secondPortId: null,
          patientPortId: null,
        };
      }

      if (!current.secondPortId) {
        if (current.firstPortId === portId) {
          setStatusText('第一步的起点接口不能重复，请选择另一个接口。');
          return current;
        }

        setStatusText('第一步已完成。请继续“再接引流管”。');
        return {
          ...current,
          secondPortId: portId,
        };
      }

      if (portId === current.firstPortId || portId === current.secondPortId) {
      setStatusText('“再接引流管”要接在剩下的那个孔上，请选择未参与第一步连接的接口。');
        return current;
      }

      setStatusText('两步接管都已完成，可以提交判定。');
      return {
        ...current,
        patientPortId: portId,
      };
    });
  }

  async function handleSubmit() {
    if (!sessionId) {
      setStatusText('请先开始挑战。');
      return;
    }

    if (!answer.firstPortId || !answer.secondPortId || !answer.patientPortId) {
      setStatusText('请先完成两步接管：先接连接管，再接引流管。');
      return;
    }

    setSubmitting(true);
    setErrorText('');

    try {
      const payload = await submitSession({
        sessionId,
        playerName: playerName.trim() || '匿名同学',
        source: GAME_SOURCE,
        answer: answer as SubmittedConnectionAnswer,
      });

      setResult(payload.result);
      setStats(payload.stats);
      setStatusText(
        payload.result.isCorrect
          ? '判定正确：先接连接管、再接引流管，顺序和接口都正确。'
          : '判定错误：必须先接连接管，再接引流管。',
      );
    } catch (error) {
      setErrorText((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetStats() {
    if (!window.confirm('确认重置统计吗？这会清空正确人数、错误人数和最近提交记录。')) {
      return;
    }

    setResetting(true);
    setErrorText('');

    try {
      const nextStats = await resetStats();
      setStats(nextStats);
      setSessionId(null);
      setStartedAt(null);
      setAnswer(EMPTY_ANSWER);
      setResult(null);
      setIntroOpen(true);
      setStatusText('统计已重置，可以重新开始新的练习。');
    } catch (error) {
      setErrorText((error as Error).message);
    } finally {
      setResetting(false);
    }
  }

  const progress =
    Number(Boolean(answer.firstPortId && answer.secondPortId)) +
    Number(Boolean(answer.patientPortId));
  const detail = result?.details[0] ?? null;

  return (
    <>
      <main className={`app-shell ${introOpen ? 'is-blocked' : ''}`}>
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Chest Drain Trainer</p>
            <h1>双腔式胸腔闭式引流瓶连接管训练</h1>
            <p className="hero-description">
              模型保留原本自带的短管和长管，其他接口初始都不接连接管。练习分两步：先接连接管，再接引流管。
            </p>
            <div className="hero-chips">
              <span>进入先登记姓名</span>
              <span>单指旋转</span>
              <span>双指缩放</span>
              <span>两步完成接管</span>
            </div>
          </div>
          <div className="hero-stats">
            <div className="metric-card">
              <strong>{stats?.correctCount ?? 0}</strong>
              <span>正确人数</span>
            </div>
            <div className="metric-card">
              <strong>{stats?.incorrectCount ?? 0}</strong>
              <span>错误人数</span>
            </div>
            <div className="metric-card">
              <strong>{stats?.accuracy ?? 0}%</strong>
              <span>当前正确率</span>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <section className="control-card entry-card">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{sessionId ? '当前挑战者' : '学生入口'}</p>
                <h2>{sessionId ? playerName : '登记姓名后开始'}</h2>
              </div>
            </div>
            {sessionId ? (
              <>
                <div className="player-summary">
                  <strong>{playerName}</strong>
                  <span>{startedAt ? `本局开始于 ${new Date(startedAt).toLocaleString()}` : '准备开始本轮操作'}</span>
                </div>
                <div className="control-actions">
                  <button className="primary-button" onClick={() => void handleStart(playerName)} disabled={starting}>
                    {starting ? '正在开始...' : result ? '再来一轮' : '重新开始本轮'}
                  </button>
                  <button className="secondary-button" onClick={openIntroGate} disabled={starting}>
                    更换姓名
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="placeholder-text">
                  进入页面后先登记姓名，再开始接管挑战。这样统计面板会直接记录到对应同学。
                </p>
                <div className="control-actions control-actions-single">
                  <button className="primary-button" onClick={openIntroGate}>
                    输入姓名并开始
                  </button>
                </div>
              </>
            )}
          </section>

          <div className="viewer-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">3D 模型</p>
                <h2>练习分两步：先接连接管，再接引流管</h2>
              </div>
              <div className="panel-badge">进度 {progress}/2</div>
            </div>
            <div className="viewer-stage">
              <DrainageModelViewer
                answer={answer}
                result={result}
                disabled={!sessionId || Boolean(result)}
                onSelectPort={handlePortSelect}
              />
              <div className="viewer-overlay">
                <p>{getPrompt(answer, result)}</p>
              </div>
            </div>
          </div>

          <section className="control-card submit-card">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">最后提交</p>
                <h2>完成操作后判定</h2>
              </div>
            </div>
            <div className="control-actions control-actions-single">
              <button
                className="secondary-button"
                onClick={handleSubmit}
                disabled={!sessionId || submitting || Boolean(result)}
              >
                {submitting ? '正在判定...' : '提交判定'}
              </button>
            </div>
            <div className="status-box">
              <p>{statusText}</p>
              {startedAt ? <span>本局开始于 {new Date(startedAt).toLocaleString()}</span> : null}
              {errorText ? <strong>{errorText}</strong> : null}
            </div>
          </section>

          <section className="control-card rules-card">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">本轮规则</p>
                <h2>只有一种连接正确</h2>
              </div>
            </div>
            <div className="connection-steps">
              <article className="question-card is-active">
                <span className="question-index">01</span>
                <div>
                  <strong>练习分两步：先接连接管，再接引流管</strong>
                  <p>模型初始不显示连接管，点第一个接口后连接管才出现，再点第二个接口完成第一步。</p>
                  <small>
                    当前第一步：
                    {`${describePort(answer.firstPortId)} -> ${describePort(answer.secondPortId)}`}
                  </small>
                </div>
              </article>
              <article className="question-card">
                <span className="question-index">02</span>
                <div>
                  <strong>再接引流管</strong>
                  <p>第一步完成后，请点击剩余未连接的那个孔，为它接上一根引流管。</p>
                  <small>当前第二步：{describePort(answer.patientPortId)}</small>
                </div>
              </article>
            </div>
          </section>

          <section className="control-card stats-card">
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">全班统计</p>
                <h2>扫码后实时累计</h2>
              </div>
              <button
                className="ghost-button"
                onClick={handleResetStats}
                disabled={resetting || statsLoading}
              >
                {resetting ? '重置中...' : '重置统计'}
              </button>
            </div>
            {statsLoading ? (
              <p className="placeholder-text">正在读取统计...</p>
            ) : (
              <div className="attempt-list">
                {stats?.recentAttempts.length ? (
                  stats.recentAttempts.map((attempt) => (
                    <article key={`${attempt.playerName}-${attempt.submittedAt}`} className="attempt-item">
                      <div>
                        <strong>{attempt.playerName}</strong>
                        <span>{new Date(attempt.submittedAt).toLocaleString()}</span>
                      </div>
                      <b className={attempt.isCorrect ? 'pill success' : 'pill warning'}>
                        {attempt.score}/{attempt.total}
                      </b>
                    </article>
                  ))
                ) : (
                  <p className="placeholder-text">还没有同学提交结果，第一位来试试。</p>
                )}
              </div>
            )}
          </section>
        </section>

        {result && detail ? (
          <section className="feedback-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">结果反馈</p>
                <h2>{result.isCorrect ? '本次连接正确' : '本次连接错误'}</h2>
              </div>
              <div className={`result-banner ${result.isCorrect ? 'success' : 'warning'}`}>
                {result.score}/{result.total}
              </div>
            </div>
            <div className="feedback-grid feedback-grid-single">
              <article className={`feedback-card ${detail.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                <strong>练习分两步：先接连接管，再接引流管</strong>
                <p>本次先接连接管：{`${describePort(detail.selectedPortIds[0])} -> ${describePort(detail.selectedPortIds[1])}`}</p>
                <span>
                  正确先接连接管：
                  {`${describePort(detail.correctPortIds[0])} -> ${describePort(detail.correctPortIds[1])}`}
                </span>
                <p>本次再接引流管：{`${describePort(detail.selectedPatientPortId)} -> 引流管`}</p>
                <span>
                  正确再接引流管：
                  {`${describePort(detail.correctPatientPortId)} -> 引流管`}
                </span>
              </article>
            </div>
          </section>
        ) : null}

        <footer className="site-footer" aria-label="网站备案信息">
          {SITE_RECORDS.map((record) => (
            <p
              key={record.iconAlt}
              className={`site-footer__item ${record.label ? '' : 'site-footer__item--icon-only'}`}
              aria-label={record.label || record.ariaLabel}
            >
              <img className="site-footer__icon" src={record.iconSrc} alt={record.iconAlt} />
              {record.label ? (
                <a href={record.href} target="_blank" rel="noreferrer">
                  {record.label}
                </a>
              ) : null}
            </p>
          ))}
        </footer>
      </main>

      {introOpen ? (
        <div className="entry-gate" role="dialog" aria-modal="true" aria-labelledby="entry-gate-title">
          <div className="entry-gate__card">
            <p className="entry-gate__eyebrow">Challenge Check-In</p>
            <h2 id="entry-gate-title">先输入姓名，再开始挑战</h2>
            <p className="entry-gate__description">
              录入姓名后会开始一局新的训练，并把本次成绩记录到统计面板。
            </p>
            <label className="input-block">
              <span>姓名</span>
              <input
                autoFocus
                value={entryName}
                onChange={(event) => setEntryName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleStart();
                  }
                }}
                placeholder="例如：护理 1 班 张三"
              />
            </label>
            <div className="entry-gate__tips">
              <span>1. 先接连接管</span>
              <span>2. 再接引流管</span>
              <span>3. 完成后提交判定</span>
            </div>
            <div className="control-actions control-actions-single">
              <button className="primary-button entry-gate__button" onClick={() => void handleStart()} disabled={starting}>
                {starting ? '正在开始...' : '开始挑战'}
              </button>
            </div>
            {entryErrorText ? (
              <div className="status-box compact-status">
                <strong>{entryErrorText}</strong>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default App;
