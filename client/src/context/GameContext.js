import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

const Ctx = createContext(null);

export function GameProvider({ children }) {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState('lobby');
  const [sessionType, setSessionType] = useState(null);
  const [roundData, setRoundData] = useState(null);
  const [roundResults, setRoundResults] = useState(null);
  const [finalResults, setFinalResults] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [bastaInfo, setBastaInfo] = useState(null);
  const [graceLeft, setGraceLeft] = useState(0);
  const [fixedLeft, setFixedLeft] = useState(0);
  const [scoreboard, setScoreboard] = useState([]);
  const [forceSubmit, setForceSubmit] = useState(false);
  const [scrambleData, setScrambleData] = useState(null);
  const [scrambleTimeLeft, setScrambleTimeLeft] = useState(0);
  const [scrambleCorrect, setScrambleCorrect] = useState(null);
  const [scrambleResults, setScrambleResults] = useState(null);
  const [scrambleRunning, setScrambleRunning] = useState(false);

  const graceRef = useRef(null);
  const fixedRef = useRef(null);

  // SEPARATE scramble timer that runs on its own
  useEffect(() => {
    if (!scrambleRunning || scrambleTimeLeft <= 0) return;
    const id = setInterval(() => {
      setScrambleTimeLeft(prev => {
        if (prev <= 1) { setScrambleRunning(false); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [scrambleRunning, scrambleTimeLeft > 0]); // only re-run when scrambleRunning changes or time hits 0

  const clearBastaTimers = useCallback(() => {
    if (graceRef.current) { clearInterval(graceRef.current); graceRef.current = null; }
    if (fixedRef.current) { clearInterval(fixedRef.current); fixedRef.current = null; }
  }, []);

  const resetToLobby = useCallback(() => {
    setPhase('lobby'); setSessionType(null); setRoundData(null); setRoundResults(null);
    setFinalResults(null); setBastaInfo(null); setScoreboard([]); setForceSubmit(false);
    setScrambleData(null); setScrambleResults(null); setScrambleCorrect(null);
    setScrambleTimeLeft(0); setScrambleRunning(false); clearBastaTimers();
    try { localStorage.removeItem('basta_draft'); } catch {}
  }, [clearBastaTimers]);

  useEffect(() => {
    if (!socket) return;

    socket.on('game:state', (s) => {
      setGameState(s);
      if (s.sessionState === 'idle' && phase !== 'lobby') setPhase('waiting');
    });

    socket.on('reconnected', (data) => {
      setGameState(data.state);
      if (data.standings) setScoreboard(data.standings);
      if (data.sessionType === 'basta') {
        setSessionType('basta');
        if (data.roundData) setRoundData(data.roundData);
        if (data.session === 'playing' || data.session === 'grace') setPhase('playing');
        else if (['reviewing', 'collecting', 'validating'].includes(data.session)) setPhase('validating');
        else if (data.session === 'results') { setPhase('results'); if (data.lastResult) setRoundResults(data.lastResult); }
        else setPhase('waiting');
      } else if (data.sessionType === 'scramble') {
        setSessionType('scramble');
        if (data.session === 'playing' && data.scrambleData) { setPhase('playing'); setScrambleData(data.scrambleData); }
        else setPhase('waiting');
      } else setPhase('waiting');
    });

    socket.on('scoreboard:update', (s) => setScoreboard(s));
    socket.on('player:joined', ({ name }) => toast(`🎮 ${name} se ha unido`, { icon: '👋' }));
    socket.on('error:message', (m) => toast.error(m));

    // === BASTA ===
    socket.on('round:countdown', ({ standings }) => {
      setSessionType('basta'); setPhase('countdown'); setRoundResults(null); setBastaInfo(null);
      setForceSubmit(false); setScoreboard(standings || []); clearBastaTimers();
      setScrambleRunning(false);
      setCountdown(3);
      setTimeout(() => setCountdown(2), 1000);
      setTimeout(() => setCountdown(1), 2000);
      setTimeout(() => setCountdown(null), 3000);
    });

    socket.on('round:start', (data) => {
      setPhase('playing'); setRoundData(data); setForceSubmit(false);
      if (data.endMode?.startsWith('fixed_')) {
        const s = parseInt(data.endMode.split('_')[1]); setFixedLeft(s);
        if (fixedRef.current) clearInterval(fixedRef.current);
        fixedRef.current = setInterval(() => setFixedLeft(p => { if (p <= 1) { clearInterval(fixedRef.current); fixedRef.current = null; return 0; } return p - 1; }), 1000);
      }
    });

    socket.on('round:basta', (info) => {
      setBastaInfo(info); setPhase('grace');
      if (info.graceMs > 0) {
        setGraceLeft(Math.ceil(info.graceMs / 1000));
        if (graceRef.current) clearInterval(graceRef.current);
        graceRef.current = setInterval(() => setGraceLeft(p => { if (p <= 1) { clearInterval(graceRef.current); graceRef.current = null; return 0; } return p - 1; }), 1000);
      }
      if (fixedRef.current) { clearInterval(fixedRef.current); fixedRef.current = null; setFixedLeft(0); }
    });

    socket.on('round:force_submit', () => setForceSubmit(true));
    socket.on('round:collecting', () => { setPhase('collecting'); clearBastaTimers(); });
    socket.on('round:validating', () => setPhase('validating'));
    socket.on('round:results', (r) => { setPhase('results'); setRoundResults(r); clearBastaTimers(); try { localStorage.removeItem('basta_draft'); } catch {} });
    socket.on('game:finished', (r) => { setPhase('finished'); setFinalResults(r); clearBastaTimers(); setScrambleRunning(false); });

    // === SCRAMBLE ===
    socket.on('scramble:countdown', ({ standings, minutes }) => {
      setSessionType('scramble'); setPhase('countdown'); setScoreboard(standings || []);
      setScrambleResults(null); setScrambleCorrect(null);
      setScrambleRunning(false);
      setScrambleTimeLeft(minutes * 60);
      clearBastaTimers();
      setCountdown(3);
      setTimeout(() => setCountdown(2), 1000);
      setTimeout(() => setCountdown(1), 2000);
      setTimeout(() => setCountdown(null), 3000);
    });

    socket.on('scramble:start', (data) => {
      setPhase('playing');
      setScrambleData(data);
      const secs = (data.minutes || 2) * 60;
      setScrambleTimeLeft(secs);
      // This triggers the separate useEffect timer
      setScrambleRunning(true);
      console.log(`🔤 Scramble started: ${secs} seconds`);
    });

    socket.on('scramble:word', (data) => { setScrambleData(data); setScrambleCorrect(null); });
    socket.on('scramble:correct', (data) => { setScrambleCorrect(data); });
    socket.on('scramble:end', (data) => {
      setPhase('finished'); setScrambleResults(data); setScrambleRunning(false);
      clearBastaTimers();
    });

    socket.on('admin:left', ({ message }) => { toast.error(message); resetToLobby(); });

    return () => {
      ['game:state','reconnected','scoreboard:update','player:joined','error:message',
       'round:countdown','round:start','round:basta','round:force_submit','round:collecting',
       'round:validating','round:results','game:finished',
       'scramble:countdown','scramble:start','scramble:word','scramble:correct','scramble:end',
       'admin:left'].forEach(e => socket.off(e));
      clearBastaTimers();
    };
  }, [socket, clearBastaTimers, resetToLobby, phase]);

  const emit = useCallback((e, d) => socket?.emit(e, d), [socket]);

  return <Ctx.Provider value={{
    gameState, phase, sessionType, roundData, roundResults, finalResults,
    countdown, bastaInfo, graceLeft, fixedLeft, scoreboard, forceSubmit,
    scrambleData, scrambleTimeLeft, scrambleCorrect, scrambleResults,
    activate: () => emit('admin:activate'),
    deactivate: () => emit('admin:deactivate'),
    updateConfig: (c) => emit('admin:config', c),
    startBasta: () => emit('game:start_basta'),
    startScramble: () => emit('game:start_scramble'),
    pressBasta: (a) => emit('player:basta', a),
    submitAnswers: (a) => emit('player:answers', a),
    submitScramble: (a) => emit('scramble:answer', a),
    nextRound: () => emit('round:next'),
    resetGame: () => emit('game:reset'),
    resetToLobby,
  }}>{children}</Ctx.Provider>;
}

export function useGame() { return useContext(Ctx); }
