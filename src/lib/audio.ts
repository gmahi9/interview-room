export async function decodeMono16k(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  const context = new AudioContext({ sampleRate: 16000 });
  try {
    const audio = await context.decodeAudioData(bytes.slice(0));
    const channels = audio.numberOfChannels;
    const mono = new Float32Array(audio.length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = audio.getChannelData(channel);
      for (let i = 0; i < audio.length; i += 1) mono[i] += data[i] / channels;
    }
    if (audio.sampleRate === 16000) return mono;
    return resampleLinear(mono, audio.sampleRate, 16000);
  } finally {
    await context.close();
  }
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(length);
  const last = input.length - 1;
  for (let i = 0; i < length; i += 1) {
    const position = Math.min(last, i * ratio);
    const index = Math.floor(position);
    const next = Math.min(last, index + 1);
    const mix = position - index;
    output[i] = input[index] * (1 - mix) + input[next] * mix;
  }
  return output;
}

export function preferredAudioMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}
