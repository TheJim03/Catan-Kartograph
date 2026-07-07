import { useCallback, useEffect, useRef, useState } from 'react';
import { generateBest } from '../generator/generate';
import GenWorker from '../generator/worker?worker&inline';
import { GenResult, GenSettings } from '../model/types';

export interface GeneratorState {
  status: 'idle' | 'working' | 'done' | 'error';
  progress: number; // 0–1
  result: GenResult | null;
  error: string | null;
}

/**
 * Führt die Generierung bevorzugt im Web Worker aus (UI blockiert nicht beim
 * Durchsuchen hunderter Kandidaten). Wenn die Umgebung keine Worker erlaubt
 * (z. B. stark gesandboxte iframes), fällt der Hook auf synchrone Ausführung
 * zurück — deterministisch identisches Ergebnis.
 */
export function useGenerator() {
  const [state, setState] = useState<GeneratorState>({
    status: 'idle', progress: 0, result: null, error: null,
  });
  const workerRef = useRef<Worker | null>(null);
  const workerBroken = useRef(false);
  const requestId = useRef(0);
  const watchdog = useRef<number | null>(null);

  const clearWatchdog = () => {
    if (watchdog.current != null) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
  };

  const runSync = useCallback((settings: GenSettings, id: number) => {
    // Kurzes Timeout, damit der „Arbeitet…“-Zustand rendern kann.
    setTimeout(() => {
      if (id !== requestId.current) return;
      try {
        const result = generateBest(settings);
        if (id !== requestId.current) return;
        if (!result) {
          setState({ status: 'error', progress: 0, result: null, error: 'Constraints unerfüllbar — bitte Regeln lockern.' });
        } else {
          setState({ status: 'done', progress: 1, result, error: null });
        }
      } catch (err) {
        setState({ status: 'error', progress: 0, result: null, error: String(err) });
      }
    }, 20);
  }, []);

  const generate = useCallback((settings: GenSettings) => {
    const id = ++requestId.current;
    clearWatchdog();
    setState((s) => ({ ...s, status: 'working', progress: 0, error: null }));

    if (!workerBroken.current && workerRef.current === null) {
      try {
        const w = new GenWorker();
        w.onmessage = (e: MessageEvent) => {
          const msg = e.data;
          if (msg.requestId !== requestId.current) return;
          clearWatchdog();
          if (msg.type === 'progress') {
            setState((s) => ({ ...s, progress: msg.done / msg.total }));
            // Worker lebt — Watchdog für den Rest der Berechnung neu aufziehen.
            watchdog.current = window.setTimeout(() => {
              if (msg.requestId !== requestId.current) return;
              workerBroken.current = true;
              workerRef.current?.terminate();
              workerRef.current = null;
              runSync(settings, requestId.current);
            }, 4000);
          } else if (msg.type === 'done') {
            if (!msg.result) {
              setState({ status: 'error', progress: 0, result: null, error: 'Constraints unerfüllbar — bitte Regeln lockern.' });
            } else {
              setState({ status: 'done', progress: 1, result: msg.result, error: null });
            }
          }
        };
        w.onerror = () => {
          workerBroken.current = true;
          workerRef.current?.terminate();
          workerRef.current = null;
          runSync(settings, requestId.current);
        };
        workerRef.current = w;
      } catch {
        workerBroken.current = true;
      }
    }

    if (workerBroken.current || !workerRef.current) {
      runSync(settings, id);
      return;
    }

    workerRef.current.postMessage({ type: 'generate', requestId: id, settings });
    // Watchdog: meldet sich der Worker nicht, synchron weitermachen.
    watchdog.current = window.setTimeout(() => {
      if (id !== requestId.current) return;
      workerBroken.current = true;
      workerRef.current?.terminate();
      workerRef.current = null;
      runSync(settings, id);
    }, 2500);
  }, [runSync]);

  useEffect(() => () => {
    clearWatchdog();
    workerRef.current?.terminate();
  }, []);

  return { state, generate };
}
