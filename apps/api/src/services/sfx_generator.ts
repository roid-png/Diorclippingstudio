import fs from "node:fs";
import path from "node:path";

function createWavBuffer(sampleRate: number, numChannels: number, samples: Float32Array[]): Buffer {
  const numSamples = samples[0]!.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF Chunk
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt Subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // Bits per sample

  // data Subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, samples[ch]![i]!));
      const val = s < 0 ? s * 0x8000 : s * 0x7fff;
      buffer.writeInt16LE(Math.floor(val), offset);
      offset += 2;
    }
  }

  return buffer;
}

/**
 * [FASE 4: BOOM SUB-BASS IMPACT SFX (0.0s)]
 * Deep sub-bass impact lembut (volume 22%, fade-out halus) saat Hook pertama kali muncul.
 */
export function generateBoomWav(): Buffer {
  const sampleRate = 44100;
  const duration = 1.3;
  const totalSamples = Math.floor(sampleRate * duration);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  let phase = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Exponential frequency sweep: starts at 90Hz and drops smoothly to 32Hz
    const freq = 32 + (90 - 32) * Math.exp(-t * 3.5);
    phase += (2 * Math.PI * freq) / sampleRate;

    // Fast attack (10ms) and smooth exponential decay (volume 22%)
    const attack = Math.min(1, t / 0.015);
    const decay = Math.exp(-t * 2.8);
    const subBass = Math.sin(phase) + 0.3 * Math.sin(phase * 0.5) + 0.15 * Math.sin(phase * 1.5);
    const sampleVal = subBass * attack * decay * 0.22;

    left[i] = sampleVal;
    right[i] = sampleVal;
  }

  return createWavBuffer(sampleRate, 2, [left, right]);
}

/**
 * [FASE 4: WHOOSH AIR SWEEP SFX (3.9s - 4.6s)]
 * Hembusan udara sinematik lembut (volume 18%) tepat saat Hook bertransisi keluar.
 */
export function generateWhooshWav(): Buffer {
  const sampleRate = 44100;
  const duration = 0.85;
  const totalSamples = Math.floor(sampleRate * duration);
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  let b0 = 0, b1 = 0, b2 = 0;
  let phase = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Bell envelope peaking at t=0.38s
    const envelope = Math.sin((Math.PI * t) / duration);
    const envFactor = Math.pow(Math.max(0, envelope), 2.2);

    // Multi-frequency air rush sweep
    const centerFreq = 220 + 340 * Math.sin((Math.PI * t) / duration);
    phase += (2 * Math.PI * centerFreq) / sampleRate;

    // Pink noise approximation
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.12;

    const airTone = Math.sin(phase) * 0.25;
    const sampleVal = (pink + airTone) * envFactor * 0.18;

    left[i] = sampleVal;
    right[i] = sampleVal * 0.95; // Slight stereo width
  }

  return createWavBuffer(sampleRate, 2, [left, right]);
}

/**
 * Ensures boom.wav and whoosh.wav exist on disk and returns their absolute paths.
 */
export function getOrBuildSfxFiles(): { boomWavPath: string; whooshWavPath: string } {
  const candidateDirs = [
    path.resolve("backend/assets/sfx"),
    path.resolve("website-tahapan-dengan-kemauan-ku/backend/assets/sfx"),
    path.resolve(process.cwd(), "assets/sfx"),
  ];

  let targetDir = candidateDirs[0]!;
  for (const d of candidateDirs) {
    if (fs.existsSync(path.dirname(d))) {
      targetDir = d;
      break;
    }
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const boomWavPath = path.join(targetDir, "boom.wav");
  const whooshWavPath = path.join(targetDir, "whoosh.wav");

  if (!fs.existsSync(boomWavPath) || fs.statSync(boomWavPath).size < 1000) {
    const boomBuf = generateBoomWav();
    fs.writeFileSync(boomWavPath, boomBuf);
    console.log(`[SFXGenerator] boom.wav berhasil digenerate: ${boomWavPath} (${boomBuf.length} bytes)`);
  }

  if (!fs.existsSync(whooshWavPath) || fs.statSync(whooshWavPath).size < 1000) {
    const whooshBuf = generateWhooshWav();
    fs.writeFileSync(whooshWavPath, whooshBuf);
    console.log(`[SFXGenerator] whoosh.wav berhasil digenerate: ${whooshWavPath} (${whooshBuf.length} bytes)`);
  }

  return { boomWavPath, whooshWavPath };
}

