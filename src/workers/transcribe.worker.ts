import * as ort from 'onnxruntime-web/webgpu';

type LoadMessage = {
  type: 'load';
  model: string;
  wasm: { wasm: string; mjs: string };
};

type TranscribeMessage = {
  type: 'transcribe';
  id: number;
  audio: Float32Array;
};

type InMessage = LoadMessage | TranscribeMessage;

type Pipeline = (
  audio: Float32Array,
  options: {
    language: string;
    task: string;
    return_timestamps: boolean;
    chunk_length_s?: number;
    stride_length_s?: number;
  },
) => Promise<{ text?: string }>;

let transcriber: Pipeline | null = null;
let loadedModel = '';
let loadPromise: Promise<void> | null = null;

interface WorkerScope {
  onmessage: ((event: MessageEvent<InMessage>) => void) | null;
  postMessage: (data: unknown) => void;
}

const scope = self as unknown as WorkerScope;

function post(data: Record<string, unknown>) {
  scope.postMessage(data);
}

async function ensureModel(model: string, wasm: { wasm: string; mjs: string }) {
  if (transcriber && loadedModel === model) {
    post({ type: 'ready', model });
    return;
  }
  if (!loadPromise || loadedModel !== model) {
    loadedModel = model;
    transcriber = null;
    ort.env.wasm.wasmPaths = wasm;
    ort.env.wasm.numThreads = 1;
    loadPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      const created = await pipeline('automatic-speech-recognition', model, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (update) => {
          const status = 'status' in update ? update.status : '';
          if (status === 'progress' && 'progress' in update && typeof update.progress === 'number') {
            const file = 'file' in update && typeof update.file === 'string' ? update.file : 'model';
            post({
              type: 'progress',
              progress: Math.max(0, Math.min(100, update.progress)),
              label: `Downloading ${file}`,
            });
            return;
          }
          if (status === 'progress_total' && 'progress' in update && typeof update.progress === 'number') {
            post({
              type: 'progress',
              progress: Math.max(0, Math.min(100, update.progress)),
              label: 'Downloading the speech model',
            });
          }
        },
      });
      transcriber = created as unknown as Pipeline;
    })().catch((error: unknown) => {
      loadPromise = null;
      transcriber = null;
      loadedModel = '';
      throw error;
    });
  }
  await loadPromise;
  post({ type: 'ready', model });
}

scope.onmessage = (event: MessageEvent<InMessage>) => {
  const message = event.data;
  if (message.type === 'load') {
    ensureModel(message.model, message.wasm)
      .catch((error: unknown) => {
        post({
          type: 'error',
          message: error instanceof Error ? error.message : 'The speech model could not load.',
        });
      });
    return;
  }
  const audio = message.audio;
  const id = message.id;
  if (!transcriber) {
    post({ type: 'error', id, message: 'Load the speech model before transcribing.' });
    return;
  }
  const seconds = audio.length / 16000;
  const options = {
    language: 'english',
    task: 'transcribe',
    return_timestamps: true,
    ...(seconds > 28 ? { chunk_length_s: 30, stride_length_s: 5 } : {}),
  };
  transcriber(audio, options)
    .then((result) => {
      post({ type: 'result', id, text: result.text ?? '' });
    })
    .catch((error: unknown) => {
      post({
        type: 'error',
        id,
        message: error instanceof Error ? error.message : 'Transcription failed.',
      });
    });
};
