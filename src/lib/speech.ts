export const SPEECH_MODELS = [
  {
    id: 'Xenova/whisper-tiny.en',
    label: 'Tiny English',
    detail: 'Smaller download. A good start in a quiet room.',
  },
  {
    id: 'Xenova/whisper-base.en',
    label: 'Base English',
    detail: 'Clearer on longer answers. A larger download.',
  },
] as const;

export type SpeechModelId = (typeof SPEECH_MODELS)[number]['id'];

export const MODEL_STORAGE_KEY = 'ipr-speech-model';

type WorkerOut =
  | { type: 'progress'; progress: number; label: string }
  | { type: 'ready'; model: string }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; message: string; id?: number };

export interface SpeechClient {
  load: (model: SpeechModelId, onProgress: (progress: number, label: string) => void) => Promise<void>;
  transcribe: (audio: Float32Array) => Promise<string>;
  stop: () => void;
}

export function createSpeechClient(workerFactory: () => Worker = defaultWorker): SpeechClient {
  let worker: Worker | null = null;
  let nextId = 1;
  const waiters = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
  let readyWait: { resolve: () => void; reject: (error: Error) => void; onProgress: (progress: number, label: string) => void } | null = null;

  function failAll(error: Error) {
    readyWait?.reject(error);
    readyWait = null;
    for (const waiter of waiters.values()) waiter.reject(error);
    waiters.clear();
  }

  function ensure(): Worker {
    if (worker) return worker;
    worker = workerFactory();
    worker.onmessage = (event: MessageEvent<WorkerOut>) => {
      const data = event.data;
      if (data.type === 'progress') {
        readyWait?.onProgress(data.progress, data.label);
        return;
      }
      if (data.type === 'ready') {
        readyWait?.resolve();
        readyWait = null;
        return;
      }
      if (data.type === 'result') {
        waiters.get(data.id)?.resolve(data.text);
        waiters.delete(data.id);
        return;
      }
      if (data.id != null && waiters.has(data.id)) {
        waiters.get(data.id)?.reject(new Error(data.message));
        waiters.delete(data.id);
        return;
      }
      failAll(new Error(data.message));
    };
    worker.onerror = () => {
      failAll(new Error('The speech worker stopped.'));
    };
    return worker;
  }

  return {
    load(model, onProgress) {
      const current = ensure();
      return new Promise<void>((resolve, reject) => {
        readyWait = { resolve, reject, onProgress };
        current.postMessage({ type: 'load', model, wasmSuffix: runtimeSuffix() });
      });
    },
    transcribe(audio) {
      const current = ensure();
      const id = nextId;
      nextId += 1;
      return new Promise<string>((resolve, reject) => {
        waiters.set(id, { resolve, reject });
        const copy = new Float32Array(audio);
        current.postMessage({ type: 'transcribe', id, audio: copy }, [copy.buffer]);
      });
    },
    stop() {
      worker?.terminate();
      worker = null;
      failAll(new Error('Transcription was stopped.'));
    },
  };
}

function defaultWorker(): Worker {
  return new Worker(new URL('../workers/transcribe.worker.ts', import.meta.url), { type: 'module' });
}

let sharedClient: SpeechClient | null = null;

export function getSpeechClient(): SpeechClient {
  if (!sharedClient) sharedClient = createSpeechClient();
  return sharedClient;
}

function runtimeSuffix(): '' | '.asyncify' {
  const ua = navigator.userAgent;
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua);
  const major = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? '0');
  return safari && major > 0 && major < 26 && !('gpu' in navigator) ? '' : '.asyncify';
}
