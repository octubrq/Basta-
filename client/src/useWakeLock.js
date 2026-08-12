import { useEffect, useRef } from 'react';

// Mantiene la pantalla encendida mientras `active` sea true.
// Chrome lo soporta; en Safari iOS es irregular, así que TODO falla en silencio
// y nunca puede romper la app (es una defensa secundaria, no la única).
export function useWakeLock(active) {
  const lockRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        lockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        /* Safari iOS / gesto requerido / batería baja — ignorar */
      }
    };

    // El sistema libera el lock al ocultar la pestaña; al volver, re-adquirir.
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };

    request();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      try { lockRef.current?.release?.(); } catch { /* noop */ }
      lockRef.current = null;
    };
  }, [active]);
}
