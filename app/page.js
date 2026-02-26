'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'guandan-web-v1';
const LEVELS = ['0', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A1', 'A2', 'A3'];

const DEFAULT_STATE = {
  lang: 'zh',
  seniorMode: false,
  soundOn: true,
  keepAwake: true,
  teamA: { name: '', levelIndex: 0, wins: 0 },
  teamB: { name: '', levelIndex: 0, wins: 0 },
  stageTeam: null,
};

const TEXT = {
  zh: {
    title: '掼蛋记分牌',
    subtitle: '网页记分版（本地保存）',
    teamA: 'A队',
    teamB: 'B队',
    level: '级数',
    wins: '已赢局数',
    stage: '上台',
    noStage: '未上台',
    toggleStage: '切换上台',
    nextRound: '下一局',
    hold: '长按',
    holdHint: '长按“下一局”仅清空级数',
    renamePrompt: '输入队名',
    senior: '大字',
    lang: '中文',
    soundOn: '声音',
    keepAwake: '常亮',
    to2Hint: '到2级后可切换',
    editHint: '点按改名，长按恢复默认',
  },
  en: {
    title: 'Guandan Scoreboard',
    subtitle: 'Web Edition (Local Storage)',
    teamA: 'Team A',
    teamB: 'Team B',
    level: 'Level',
    wins: 'Wins',
    stage: 'ON',
    noStage: 'No Stage',
    toggleStage: 'Toggle Stage',
    nextRound: 'Next Round',
    hold: 'Hold',
    holdHint: 'Long-press Next Round to clear levels only',
    renamePrompt: 'Team name',
    senior: 'A+',
    lang: 'EN',
    soundOn: 'Sound',
    keepAwake: 'Awake',
    to2Hint: 'Available after level 2',
    editHint: 'Tap rename, hold reset',
  },
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeState(input) {
  const s = { ...DEFAULT_STATE, ...(input || {}) };
  const teamA = { ...DEFAULT_STATE.teamA, ...(s.teamA || {}) };
  const teamB = { ...DEFAULT_STATE.teamB, ...(s.teamB || {}) };
  teamA.levelIndex = clamp(Number(teamA.levelIndex) || 0, 0, LEVELS.length - 1);
  teamB.levelIndex = clamp(Number(teamB.levelIndex) || 0, 0, LEVELS.length - 1);
  teamA.wins = clamp(Number(teamA.wins) || 0, 0, 10);
  teamB.wins = clamp(Number(teamB.wins) || 0, 0, 10);
  const stageAvailable = teamA.levelIndex > 0 || teamB.levelIndex > 0;
  const stageTeam = stageAvailable && (s.stageTeam === 'A' || s.stageTeam === 'B') ? s.stageTeam : null;
  return {
    lang: s.lang === 'en' ? 'en' : 'zh',
    seniorMode: !!s.seniorMode,
    soundOn: s.soundOn !== false,
    keepAwake: s.keepAwake !== false,
    teamA,
    teamB,
    stageTeam,
  };
}

function createSynthPlayer() {
  let ctx;

  const ensureCtx = () => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  const beep = (freq, duration = 0.07, type = 'sine', gain = 0.04, at = 0) => {
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime + at;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  };

  return {
    levelUp() {
      beep(620, 0.06, 'triangle', 0.045, 0);
      beep(820, 0.08, 'triangle', 0.04, 0.045);
    },
    levelDown() {
      beep(540, 0.06, 'sine', 0.04, 0);
      beep(360, 0.08, 'sine', 0.035, 0.05);
    },
    winChange() {
      beep(700, 0.05, 'square', 0.03, 0);
    },
    stageToggle() {
      beep(520, 0.05, 'triangle', 0.035, 0);
      beep(660, 0.05, 'triangle', 0.032, 0.04);
    },
    nextRoundHint() {
      beep(420, 0.04, 'sine', 0.03, 0);
    },
    nextRoundClear() {
      beep(460, 0.05, 'triangle', 0.035, 0);
      beep(320, 0.10, 'sawtooth', 0.02, 0.05);
    },
  };
}

function useLongPress(onLongPress, onShortPress, ms = 650) {
  const timerRef = useRef(null);
  const longTriggeredRef = useRef(false);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = () => {
    longTriggeredRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      longTriggeredRef.current = true;
      onLongPress();
    }, ms);
  };

  const end = () => {
    clear();
    if (!longTriggeredRef.current) onShortPress?.();
  };

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: clear,
  };
}

function formatLevel(level) {
  if (level.startsWith('A') && level.length === 2) {
    return { main: 'A', sub: level.slice(1) };
  }
  return { main: level, sub: '' };
}

function TeamCard({
  teamKey,
  team,
  defaultName,
  level,
  onStage,
  stageAvailable,
  labels,
  seniorMode,
  onRename,
  onResetName,
  onLevelUp,
  onLevelDown,
  onWinPlus,
  onWinMinus,
}) {
  const levelParts = formatLevel(level);
  const holdHandlers = useLongPress(onResetName, onRename, 500);

  return (
    <section className={`team-card ${teamKey} ${onStage ? 'on-stage' : ''}`}>
      {onStage && stageAvailable ? <div className="stage-top-strip">{labels.stage}</div> : null}
      <div className="team-header">
        <div className="team-mark" />
        <div className="team-title-wrap">
          <button className="team-name-btn" title={labels.editHint} {...holdHandlers}>
            <span className="team-name">{team.name || defaultName}</span>
            <span className="team-edit">✎</span>
          </button>
          {onStage && stageAvailable ? <span className="stage-badge">• {labels.stage}</span> : null}
        </div>
      </div>

      <div className={`level-panel ${onStage ? 'active' : ''}`}>
        <div className="level-label">{labels.level}</div>
        <div className={`level-value ${seniorMode ? 'senior' : ''}`}>
          <span className="level-main">{levelParts.main}</span>
          {levelParts.sub ? <span className="level-sub">{levelParts.sub}</span> : null}
        </div>
      </div>

      <div className="level-side-actions">
        <button className="icon-action up" onClick={onLevelUp} aria-label="Level Up">
          ▲
        </button>
        <button className="icon-action down" onClick={onLevelDown} aria-label="Level Down">
          ▼
        </button>
      </div>

      <div className="wins-row">
        <span className="wins-label">{labels.wins}</span>
        <div className="wins-controls">
          <button className="wins-btn" onClick={onWinMinus} aria-label="Minus">
            −
          </button>
          <span className="wins-value">{team.wins}</span>
          <button className="wins-btn" onClick={onWinPlus} aria-label="Plus">
            +
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [toast, setToast] = useState('');
  const soundRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(normalizeState(JSON.parse(raw)));
    } catch {}
  }, []);

  useEffect(() => {
    soundRef.current = createSynthPlayer();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const requestWakeLock = async () => {
      if (!state.keepAwake) return;
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current?.addEventListener?.('release', () => {
          wakeLockRef.current = null;
        });
      } catch {}
    };

    const releaseWakeLock = async () => {
      try {
        await wakeLockRef.current?.release?.();
      } catch {}
      wakeLockRef.current = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    if (state.keepAwake) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      releaseWakeLock();
    };
  }, [state.keepAwake]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister().catch(() => {}));
      });
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1100);
    return () => clearTimeout(t);
  }, [toast]);

  const labels = TEXT[state.lang];
  const stageAvailable = state.teamA.levelIndex > 0 || state.teamB.levelIndex > 0;

  const effectiveStage = useMemo(() => {
    if (!stageAvailable) return null;
    return state.stageTeam === 'A' || state.stageTeam === 'B' ? state.stageTeam : 'A';
  }, [stageAvailable, state.stageTeam]);

  const playSound = (kind) => {
    if (!state.soundOn) return;
    try {
      soundRef.current?.[kind]?.();
    } catch {}
  };

  const update = (producer) => {
    setState((prev) => {
      const next = normalizeState(typeof producer === 'function' ? producer(prev) : producer);
      if ((next.teamA.levelIndex === 0 && next.teamB.levelIndex === 0)) {
        next.stageTeam = null;
      }
      return next;
    });
  };

  const renameTeam = (key) => {
    const current = key === 'A' ? state.teamA.name : state.teamB.name;
    const value = window.prompt(labels.renamePrompt, current || '');
    if (value == null) return;
    update((prev) => ({
      ...prev,
      [key === 'A' ? 'teamA' : 'teamB']: {
        ...(key === 'A' ? prev.teamA : prev.teamB),
        name: value.trim(),
      },
    }));
  };

  const resetTeamName = (key) => {
    update((prev) => ({
      ...prev,
      [key === 'A' ? 'teamA' : 'teamB']: {
        ...(key === 'A' ? prev.teamA : prev.teamB),
        name: '',
      },
    }));
  };

  const changeLevel = (key, delta) => {
    update((prev) => {
      const teamName = key === 'A' ? 'teamA' : 'teamB';
      const team = prev[teamName];
      const nextIndex = clamp(team.levelIndex + delta, 0, LEVELS.length - 1);
      if (nextIndex === team.levelIndex) return prev;
      const next = {
        ...prev,
        [teamName]: { ...team, levelIndex: nextIndex },
      };
      const hasStage = next.teamA.levelIndex > 0 || next.teamB.levelIndex > 0;
      next.stageTeam = hasStage ? (delta > 0 ? key : prev.stageTeam) : null;
      return next;
    });
    playSound(delta > 0 ? 'levelUp' : 'levelDown');
  };

  const changeWins = (key, delta) => {
    update((prev) => {
      const teamName = key === 'A' ? 'teamA' : 'teamB';
      const team = prev[teamName];
      const wins = clamp(team.wins + delta, 0, 10);
      if (wins === team.wins) return prev;
      return { ...prev, [teamName]: { ...team, wins } };
    });
    playSound('winChange');
  };

  const toggleStage = () => {
    if (!stageAvailable) {
      setToast(labels.to2Hint);
      return;
    }
    update((prev) => ({ ...prev, stageTeam: effectiveStage === 'A' ? 'B' : 'A' }));
    playSound('stageToggle');
  };

  const nextRoundHandlers = useLongPress(
    () => {
      update((prev) => ({
        ...prev,
        teamA: { ...prev.teamA, levelIndex: 0 },
        teamB: { ...prev.teamB, levelIndex: 0 },
        stageTeam: null,
      }));
      playSound('nextRoundClear');
    },
    () => {
      setToast(labels.holdHint);
      playSound('nextRoundHint');
    },
    650,
  );

  return (
    <main className="page-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="ambient ambient-c" />

      <header className="top-bar">
        <div className="brand">
          <div className="brand-mark">掼</div>
          <div className="brand-text">
            <div className="brand-title">{labels.title}</div>
            <div className="brand-subtitle">{labels.subtitle}</div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className={`chip ${state.keepAwake ? 'active' : ''}`}
            onClick={() => update((p) => ({ ...p, keepAwake: !p.keepAwake }))}
            title={labels.keepAwake}
            aria-label={labels.keepAwake}
          >
            {state.keepAwake ? '☀︎' : '🌙'}
          </button>
          <button
            className={`chip ${state.soundOn ? 'active' : ''}`}
            onClick={() => update((p) => ({ ...p, soundOn: !p.soundOn }))}
            title={labels.soundOn}
            aria-label={labels.soundOn}
          >
            {state.soundOn ? '🔊' : '🔇'}
          </button>
          <button className={`chip ${state.seniorMode ? 'active' : ''}`} onClick={() => update((p) => ({ ...p, seniorMode: !p.seniorMode }))}>
            {labels.senior}
          </button>
          <button className="chip" onClick={() => update((p) => ({ ...p, lang: p.lang === 'zh' ? 'en' : 'zh' }))}>
            {state.lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      <section className="board-grid">
        <TeamCard
          teamKey="a"
          team={state.teamA}
          defaultName={labels.teamA}
          level={LEVELS[state.teamA.levelIndex]}
          onStage={effectiveStage === 'A'}
          stageAvailable={stageAvailable}
          labels={labels}
          seniorMode={state.seniorMode}
          onRename={() => renameTeam('A')}
          onResetName={() => resetTeamName('A')}
          onLevelUp={() => changeLevel('A', 1)}
          onLevelDown={() => changeLevel('A', -1)}
          onWinPlus={() => changeWins('A', 1)}
          onWinMinus={() => changeWins('A', -1)}
        />

        <TeamCard
          teamKey="b"
          team={state.teamB}
          defaultName={labels.teamB}
          level={LEVELS[state.teamB.levelIndex]}
          onStage={effectiveStage === 'B'}
          stageAvailable={stageAvailable}
          labels={labels}
          seniorMode={state.seniorMode}
          onRename={() => renameTeam('B')}
          onResetName={() => resetTeamName('B')}
          onLevelUp={() => changeLevel('B', 1)}
          onLevelDown={() => changeLevel('B', -1)}
          onWinPlus={() => changeWins('B', 1)}
          onWinMinus={() => changeWins('B', -1)}
        />
      </section>

      <footer className="bottom-bar">
        <button className="danger-btn" {...nextRoundHandlers}>
          <span>{labels.nextRound}</span>
          <small>{labels.hold}</small>
        </button>

        {stageAvailable ? (
          <button className="primary-btn" onClick={toggleStage}>
            {labels.toggleStage}
          </button>
        ) : (
          <div className="disabled-pill">{labels.to2Hint}</div>
        )}
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  );
}
