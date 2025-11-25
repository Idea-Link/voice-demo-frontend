function decodeBase64(base64: string): string {
  if (typeof atob !== 'undefined') {
    return atob(base64);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('binary');
  }
  throw new Error('Base64 decoding unsupported');
}

function encodeBase64(buffer: ArrayBuffer): string {
  if (typeof btoa !== 'undefined') {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  throw new Error('Base64 encoding unsupported');
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = decodeBase64(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodePcm16Base64ToBuffer(
  base64: string,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const audioBytes = base64ToUint8Array(base64);
  const dataInt16 = new Int16Array(
    audioBytes.buffer,
    audioBytes.byteOffset,
    audioBytes.byteLength / 2
  );
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  return buffer;
}

export function float32ToPcm16Base64(data: Float32Array): string {
  const buffer = new ArrayBuffer(data.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return encodeBase64(buffer);
}