/// <reference lib="webworker" />

import { evaluateRegex, type RegexEvaluationRequest } from './regex-engine';

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener(
  'message',
  (event: MessageEvent<RegexEvaluationRequest>) => {
    worker.postMessage(evaluateRegex(event.data));
  },
);

export {};
