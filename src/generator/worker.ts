/// <reference lib="webworker" />
import { generateBest } from './generate';
import { GenSettings } from '../model/types';

interface GenMessage {
  type: 'generate';
  requestId: number;
  settings: GenSettings;
}

self.onmessage = (e: MessageEvent<GenMessage>) => {
  const { requestId, settings } = e.data;
  const result = generateBest(settings, (done, total) => {
    (self as unknown as Worker).postMessage({ type: 'progress', requestId, done, total });
  });
  (self as unknown as Worker).postMessage({ type: 'done', requestId, result });
};
