import { useEffect, useRef, useState } from 'react';
import { CATEGORY_LABELS, LEVEL_LABELS } from '../data/roles';
import { cleanTranscript } from '../lib/analyze';
import { decodeMono16k, preferredAudioMime } from '../lib/audio';
import { formatClock } from '../lib/format';
import { detectPauses } from '../lib/pauses';
import { getSpeechClient, MODEL_STORAGE_KEY, SPEECH_MODELS, type SpeechModelId } from '../lib/speech';
import type { InputMode, Level, PauseSpan, Question, RoleInfo, SessionMode } from '../types';

export interface AttemptDraft {
  transcript: string;
  durationSeconds: number;
  pauses: PauseSpan[];
  inputMode: InputMode;
}

function storedModel(): SpeechModelId {
  try {
    const value = localStorage.getItem(MODEL_STORAGE_KEY);
    if (value && SPEECH_MODELS.some((item) => item.id === value)) return value as SpeechModelId;
  } catch {
    /* keep the default */
  }
  return SPEECH_MODELS[0].id;
}

export function PracticeScreen({
  role,
  level,
  mode,
  question,
  index,
  total,
  quitLabel,
  onSubmit,
  onQuit,
}: {
  role: RoleInfo;
  level: Level;
  mode: SessionMode;
  question: Question;
  index: number;
  total: number;
  quitLabel: string;
  onSubmit: (draft: AttemptDraft) => void;
  onQuit: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [phase, setPhase] = useState<'idle' | 'recording' | 'decoding'>('idle');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [pauses, setPauses] = useState<PauseSpan[]>([]);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [speechState, setSpeechState] = useState<'idle' | 'loading' | 'working'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparing the speech model');
  const [model, setModel] = useState<SpeechModelId>(storedModel);
  const [usedSpeech, setUsedSpeech] = useState(false);
  const [meter, setMeter] = useState(0);
  const accumulated = useRef(0);
  const started = useRef<number | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioLink = useRef<string | null>(null);
  const typedOnce = useRef(false);
  const alive = useRef(true);
  const take = useRef(0);

  useEffect(() => () => {
    alive.current = false;
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    stopTracks();
    if (audioLink.current) URL.revokeObjectURL(audioLink.current);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => {
      const extra = started.current == null ? 0 : (performance.now() - started.current) / 1000;
      setElapsed(accumulated.current + extra);
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    take.current += 1;
    setTranscript('');
    setElapsed(0);
    setRunning(false);
    setUsedSpeech(false);
    setSpeechError(null);
    setRecordError(null);
    setPauses([]);
    setSamples(null);
    setPhase('idle');
    typedOnce.current = false;
    accumulated.current = 0;
    started.current = null;
    if (audioLink.current) {
      URL.revokeObjectURL(audioLink.current);
      audioLink.current = null;
    }
    setAudioUrl(null);
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    stopTracks();
  }, [question.id]);

  function startClock() {
    if (started.current != null || accumulated.current > 0 && running) return;
    if (running) return;
    started.current = performance.now();
    setRunning(true);
  }

  function currentElapsed(): number {
    const extra = started.current == null ? 0 : (performance.now() - started.current) / 1000;
    return accumulated.current + extra;
  }

  function stopTracks() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  async function startRecording() {
    setRecordError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordError('This browser cannot record audio. Type the answer and you will still get feedback.');
      return;
    }
    try {
      const live = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = live;
      const mime = preferredAudioMime();
      const media = mime ? new MediaRecorder(live, { mimeType: mime }) : new MediaRecorder(live);
      chunks.current = [];
      const generation = take.current;
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stopTracks();
        if (!alive.current || generation !== take.current) return;
        const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' });
        void finishBlob(blob);
      };
      media.start();
      recorder.current = media;
      setPhase('recording');
      startClock();
      watchMeter(live);
    } catch {
      setRecordError('The microphone is unavailable. Type the answer and you will still get feedback.');
    }
  }

  function watchMeter(live: MediaStream) {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(live);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      if (!alive.current || recorder.current?.state !== 'recording') {
        void context.close();
        if (alive.current) setMeter(0);
        return;
      }
      frame = window.requestAnimationFrame(tick);
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const centered = (data[i] - 128) / 128;
        sum += centered * centered;
      }
      setMeter(Math.min(1, Math.sqrt(sum / data.length) * 4));
    };
    frame = window.requestAnimationFrame(tick);
    recorder.current?.addEventListener('stop', () => window.cancelAnimationFrame(frame), { once: true });
  }

  function stopRecording() {
    if (recorder.current && recorder.current.state !== 'inactive') {
      setPhase('decoding');
      recorder.current.stop();
      return;
    }
    stopTracks();
  }

  async function finishBlob(blob: Blob) {
    if (audioLink.current) URL.revokeObjectURL(audioLink.current);
    const url = URL.createObjectURL(blob);
    audioLink.current = url;
    setAudioUrl(url);
    try {
      const decoded = await decodeMono16k(blob);
      setSamples(decoded);
      setPauses(detectPauses(decoded, 16000));
    } catch {
      setSamples(null);
      setPauses([]);
      setRecordError('The recording was saved, but it could not be prepared for transcription. You can still type the answer.');
    } finally {
      setPhase('idle');
    }
  }

  async function transcribe() {
    const client = getSpeechClient();
    if (!samples) return;
    setSpeechError(null);
    setSpeechState('loading');
    setProgress(2);
    setProgressLabel('Preparing the speech model');
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch {
      /* the choice still applies to this session */
    }
    try {
      await client.load(model, (value, label) => {
        setProgress(value);
        setProgressLabel(label);
        setSpeechState('loading');
      });
      setSpeechState('working');
      setProgressLabel('Transcribing on this device');
      const raw = await client.transcribe(samples);
      const cleaned = cleanTranscript(raw);
      if (!cleaned) {
        setSpeechError('No speech was detected. Move closer to the microphone, or type the answer.');
      } else {
        setTranscript(cleaned);
        setUsedSpeech(true);
        startClock();
      }
    } catch (error) {
      setSpeechError(error instanceof Error ? error.message : 'Transcription could not finish. You can type the answer.');
    } finally {
      setSpeechState('idle');
    }
  }

  function resetAnswer() {
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
    stopTracks();
    setTranscript('');
    setElapsed(0);
    setRunning(false);
    setUsedSpeech(false);
    setSamples(null);
    setPauses([]);
    setSpeechError(null);
    setRecordError(null);
    typedOnce.current = false;
    accumulated.current = 0;
    started.current = null;
    if (audioLink.current) {
      URL.revokeObjectURL(audioLink.current);
      audioLink.current = null;
    }
    setAudioUrl(null);
  }

  const busy = speechState !== 'idle' || phase !== 'idle';
  const canSubmit = transcript.trim().length > 0 && !busy;

  return (
    <div className="stack">
      <p className="kicker">
        Question {index + 1} of {total}
        <span aria-hidden="true"> · </span>
        {mode === 'mock' ? 'Mock interview' : 'Practice'}
        <span aria-hidden="true"> · </span>
        {role.label}
        <span aria-hidden="true"> · </span>
        {LEVEL_LABELS[level]}
      </p>
      {role.disclaimer && <p className="note">{role.disclaimer}</p>}
      <article className="sheet">
        <div className="sheet-top">
          <span className="chip">{CATEGORY_LABELS[question.category]}</span>
          <p className="clock" aria-live="off">
            <span className="visually-hidden">Answer time </span>
            {formatClock(elapsed)}
          </p>
        </div>
        <h1 className="prompt">{question.text}</h1>
        <p className="target">A useful answer often lands near {formatClock(question.targetSeconds)}. The clock starts when you record or type.</p>
        <div className="record-row">
          {phase === 'recording' ? (
            <button type="button" className="button button-primary button-record is-live" onClick={stopRecording}>
              Stop recording
            </button>
          ) : (
            <button type="button" className="button button-primary button-record" onClick={() => void startRecording()} disabled={busy}>
              Record answer
            </button>
          )}
          <div className="meter" aria-hidden="true">
            <span style={{ transform: `scaleX(${phase === 'recording' ? Math.max(0.08, meter) : 0})` }} />
          </div>
          <p className="visually-hidden" aria-live="polite">
            {phase === 'recording' ? 'Microphone is live.' : phase === 'decoding' ? 'Preparing the recording.' : 'Microphone is off.'}
          </p>
        </div>
        {recordError && <p className="note" role="alert">{recordError}</p>}
        {audioUrl && (
          <div className="audio-block">
            <audio controls src={audioUrl} />
            <label className="field">
              Speech model
              <select
                value={model}
                onChange={(event) => setModel(event.target.value as SpeechModelId)}
                disabled={speechState !== 'idle'}
              >
                {SPEECH_MODELS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} — {item.detail}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button" onClick={() => void transcribe()} disabled={!samples || speechState !== 'idle'}>
              {speechState === 'idle' ? 'Transcribe on this device' : 'Working…'}
            </button>
            {speechState !== 'idle' && (
              <div>
                <p id="model-progress">{progressLabel}{speechState === 'loading' ? ` ${Math.round(progress)}%` : ''}</p>
                <div
                  className="bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                  aria-labelledby="model-progress"
                >
                  <span style={{ width: `${Math.max(4, progress)}%` }} />
                </div>
                <p className="fine">The download happens once. The recording never leaves this browser.</p>
              </div>
            )}
          </div>
        )}
        {speechError && <p className="note" role="alert">{speechError}</p>}
        <label className="field">
          Answer
          <textarea
            value={transcript}
            rows={8}
            onChange={(event) => {
              const value = event.target.value;
              setTranscript(value);
              if (!typedOnce.current && value.trim()) {
                typedOnce.current = true;
                startClock();
              }
            }}
            placeholder="Type here, or record and transcribe into this box."
          />
        </label>
        <div className="action-row">
          <button
            type="button"
            className="button button-primary"
            disabled={!canSubmit}
            onClick={() => {
              if (started.current != null) {
                accumulated.current += (performance.now() - started.current) / 1000;
                started.current = null;
              }
              setRunning(false);
              onSubmit({
                transcript: transcript.trim(),
                durationSeconds: Math.max(1, currentElapsed()),
                pauses: usedSpeech ? pauses : [],
                inputMode: usedSpeech ? 'speech' : 'typed',
              });
            }}
          >
            See feedback
          </button>
          <button type="button" className="button button-quiet" onClick={resetAnswer} disabled={busy}>
            Start this question over
          </button>
          <button type="button" className="button button-quiet" onClick={onQuit}>
            {quitLabel}
          </button>
        </div>
      </article>
    </div>
  );
}
