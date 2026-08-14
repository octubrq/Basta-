import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

const Ctx = createContext(null);

export function GameProvider({ children }) {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState('lobby'); // lobby|waiting|instructions|playing|grace|collecting|validating|result|finished
  const [currentPrueba, setCurrentPrueba] = useState(null);
  const [instr, setInstr] = useState(null);          // { prueba, roundIndex, totalRounds, remaining, pausedBy, solo }
  const [roundData, setRoundData] = useState(null);  // contenido de Basta
  const [roundResult, setRoundResult] = useState(null); // { podium, standings, reveal, roundIndex, totalRounds, isLast }
  const [finalResult, setFinalResult] = useState(null);
  const [bastaInfo, setBastaInfo] = useState(null);
  const [graceLeft, setGraceLeft] = useState(0);
  const [fixedLeft, setFixedLeft] = useState(0);
  const [scoreboard, setScoreboard] = useState([]);
  const [forceSubmit, setForceSubmit] = useState(false);
  const [adminPaused, setAdminPaused] = useState(false);
  const [scrambleData, setScrambleData] = useState(null);
  const [scrambleTimeLeft, setScrambleTimeLeft] = useState(0);
  const [scrambleCorrect, setScrambleCorrect] = useState(null);
  const [scrambleRunning, setScrambleRunning] = useState(false);
  // Canal genérico de "pasos" reutilizado por las pruebas nuevas (Fase 4).
  const [stepData, setStepData] = useState(null);
  const [stepReveal, setStepReveal] = useState(null);

  const graceRef = useRef(null);
  const fixedRef = useRef(null);
  const instrRef = useRef(null); // guarda roundIndex/totalRounds para la pantalla de juego
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Cuenta atrás de Letras Locas (se congela con adminPaused).
  useEffect(() => {
    if (!scrambleRunning || scrambleTimeLeft <= 0 || adminPaused) return;
    const id = setInterval(() => {
      setScrambleTimeLeft(prev => { if (prev <= 1) { setScrambleRunning(false); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [scrambleRunning, scrambleTimeLeft > 0, adminPaused]); // eslint-disable-line

  const clearBastaTimers = useCallback(() => {
    if (graceRef.current) { clearInterval(graceRef.current); graceRef.current = null; }
    if (fixedRef.current) { clearInterval(fixedRef.current); fixedRef.current = null; }
  }, []);

  const resetToLobby = useCallback(() => {
    setPhase('lobby'); setCurrentPrueba(null); setInstr(null); setRoundData(null);
    setRoundResult(null); setFinalResult(null); setBastaInfo(null); setForceSubmit(false);
    setAdminPaused(false); setScrambleData(null); setScrambleCorrect(null);
    setScrambleTimeLeft(0); setScrambleRunning(false); clearBastaTimers();
    try { localStorage.removeItem('basta_draft'); } catch { /* noop */ }
  }, [clearBastaTimers]);

  useEffect(() => {
    if (!socket) return;

    socket.on('game:state', (s) => {
      setGameState(s);
      // Sin partida en curso → volver al lobby (salvo que ya estemos ahí)
      if (!s.match && !['lobby', 'waiting'].includes(phaseRef.current)) resetToLobby();
    });

    socket.on('reconnected', (data) => {
      setGameState(data.state);
      if (data.standings) setScoreboard(data.standings);
      const m = data.match;
      if (!m) { setPhase('lobby'); return; }
      instrRef.current = { roundIndex: m.roundIndex, totalRounds: m.totalRounds };
      setAdminPaused(!!data.adminPaused);
      if (data.instr) {
        setCurrentPrueba(data.instr.prueba.id); setInstr(data.instr); setPhase('instructions');
      } else if (data.play) {
        setCurrentPrueba(data.play.prueba); setPhase('playing');
        if (data.play.prueba === 'basta') {
          setRoundData({ ...data.play.content, round: m.roundIndex + 1, totalRounds: m.totalRounds });
        } else if (data.play.prueba === 'scramble') {
          if (data.play.word) setScrambleData(data.play.word);
          setScrambleTimeLeft((data.play.content?.minutes || 2) * 60); setScrambleRunning(true);
        }
        // Pruebas de canal genérico: restaurar el paso/revelación actuales
        if (data.step) setStepData(data.step);
        if (data.stepReveal) setStepReveal(data.stepReveal);
      } else if (data.result) {
        setRoundResult(data.result); setPhase('result');
      } else if (data.finished) {
        setFinalResult({ standings: data.finished.standings, solo: data.finished.solo }); setPhase('finished');
      } else setPhase('waiting');
    });

    socket.on('scoreboard:update', (s) => setScoreboard(s));
    socket.on('player:joined', ({ name }) => toast(`🎮 ${name} se ha unido`, { icon: '👋' }));
    socket.on('error:message', (m) => toast.error(m));
    socket.on('info:message', (m) => toast.success(m));

    // ===== INSTRUCCIONES =====
    socket.on('round:instructions', (d) => {
      setCurrentPrueba(d.prueba.id);
      instrRef.current = { roundIndex: d.roundIndex, totalRounds: d.totalRounds };
      setInstr({ ...d, remaining: null, pausedBy: [] });
      setPhase('instructions'); setRoundResult(null); setBastaInfo(null); setForceSubmit(false);
      setAdminPaused(false); setScrambleCorrect(null); setScrambleRunning(false);
      setScoreboard(d.standings || []); clearBastaTimers();
    });
    socket.on('round:instr_tick', (d) => setInstr(prev => prev ? { ...prev, remaining: d.remaining, pausedBy: d.pausedBy || [] } : prev));

    // ===== JUEGO =====
    socket.on('round:play', (d) => {
      setCurrentPrueba(d.prueba); setPhase('playing'); setForceSubmit(false); setAdminPaused(false);
      setStepData(null); setStepReveal(null);
      const meta = instrRef.current || { roundIndex: 0, totalRounds: 1 };
      if (d.prueba === 'basta') {
        setRoundData({ ...d.content, round: meta.roundIndex + 1, totalRounds: meta.totalRounds });
        if (d.content.endMode?.startsWith('fixed_')) {
          const s = parseInt(d.content.endMode.split('_')[1]); setFixedLeft(s);
          if (fixedRef.current) clearInterval(fixedRef.current);
          fixedRef.current = setInterval(() => setFixedLeft(p => { if (p <= 1) { clearInterval(fixedRef.current); fixedRef.current = null; return 0; } return p - 1; }), 1000);
        }
      } else if (d.prueba === 'scramble') {
        setScrambleData(null); setScrambleCorrect(null);
        setScrambleTimeLeft((d.content?.minutes || 2) * 60); setScrambleRunning(true);
      }
    });

    // ===== BASTA =====
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

    // ===== FIN DE RONDA / PARTIDA =====
    socket.on('round:result', (r) => {
      setRoundResult(r); setPhase('result'); clearBastaTimers(); setScrambleRunning(false);
      try { localStorage.removeItem('basta_draft'); } catch { /* noop */ }
    });
    socket.on('round:skipped', () => toast('⏭️ Prueba saltada', { icon: '⏭️' }));
    socket.on('match:finished', (r) => { setFinalResult(r); setPhase('finished'); clearBastaTimers(); setScrambleRunning(false); });

    // ===== PAUSA (admin durante el juego) =====
    socket.on('round:paused', () => { setAdminPaused(true); toast('⏸️ Pausa', { icon: '⏸️' }); });
    socket.on('round:resumed', () => setAdminPaused(false));

    // ===== SCRAMBLE =====
    socket.on('scramble:word', (d) => { setScrambleData(d); setScrambleCorrect(null); });
    socket.on('scramble:correct', (d) => setScrambleCorrect(d));

    // ===== CANAL GENÉRICO DE PASOS (pruebas nuevas) =====
    socket.on('step:show', (d) => { setStepData(d); setStepReveal(null); });
    socket.on('step:reveal', (d) => setStepReveal(d));

    socket.on('admin:left', ({ message }) => { toast.error(message); resetToLobby(); });

    return () => {
      ['game:state', 'reconnected', 'scoreboard:update', 'player:joined', 'error:message', 'info:message',
        'round:instructions', 'round:instr_tick', 'round:play', 'round:basta', 'round:force_submit',
        'round:collecting', 'round:validating', 'round:result', 'round:skipped', 'match:finished',
        'round:paused', 'round:resumed', 'scramble:word', 'scramble:correct',
        'step:show', 'step:reveal', 'admin:left'].forEach(e => socket.off(e));
      clearBastaTimers();
    };
  }, [socket, clearBastaTimers, resetToLobby]);

  const emit = useCallback((e, d) => socket?.emit(e, d), [socket]);

  return <Ctx.Provider value={{
    gameState, phase, currentPrueba, instr, roundData, roundResult, finalResult,
    bastaInfo, graceLeft, fixedLeft, scoreboard, forceSubmit, adminPaused,
    scrambleData, scrambleTimeLeft, scrambleCorrect,
    stepData, stepReveal,
    submitStep: (value) => emit('step:answer', value),
    // admin / lobby
    activate: () => emit('admin:activate'),
    deactivate: () => emit('admin:deactivate'),
    updateConfig: (c) => emit('admin:config', c),
    setProfile: (playerId, profile) => emit('admin:set_profile', { playerId, profile }),
    setSoloPassword: (password) => emit('admin:set_solo_password', { password }),
    // partida
    startMatch: (cfg) => emit('match:start', cfg),
    nextRound: () => emit('round:next'),
    skipRound: () => emit('round:skip'),
    resetMatch: () => emit('match:reset'),
    pauseToggle: () => emit('match:pause_toggle'),
    adminPauseToggle: () => emit('admin:pause_toggle'),
    // juego
    pressBasta: (a) => emit('player:basta', a),
    submitAnswers: (a) => emit('player:answers', a),
    submitScramble: (a) => emit('scramble:answer', a),
    resetToLobby,
  }}>{children}</Ctx.Provider>;
}

export function useGame() { return useContext(Ctx); }
