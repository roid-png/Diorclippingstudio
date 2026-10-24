/**
 * Lightweight Zero-Dependency Cubic-Bezier Easing Engine
 * Utilizes Newton-Raphson method for high-precision, microsecond-fast easing evaluation.
 */

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const SUBDIVISION_PRECISION = 0.0000001;

const kSplineTableSize = 11;
const kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

function A(aA1: number, aA2: number) { return 1.0 - 3.0 * aA2 + 3.0 * aA1; }
function B(aA1: number, aA2: number) { return 3.0 * aA2 - 6.0 * aA1; }
function C(aA1: number) { return 3.0 * aA1; }

function calcBezier(aT: number, aA1: number, aA2: number) {
  return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
}

function getSlope(aT: number, aA1: number, aA2: number) {
  return 3.0 * A(aA1, aA2) * aT * aT + 2.0 * B(aA1, aA2) * aT + C(aA1);
}

function binarySubdivide(aX: number, aA: number, aB: number, mX1: number, mX2: number) {
  let currentX: number;
  let currentT: number;
  let i = 0;
  do {
    currentT = aA + (aB - aA) / 2.0;
    currentX = calcBezier(currentT, mX1, mX2) - aX;
    if (currentX > 0.0) {
      aB = currentT;
    } else {
      aA = currentT;
    }
  } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
  return currentT;
}

function newtonRaphsonIterate(aX: number, aGuessT: number, mX1: number, mX2: number) {
  for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
    const currentSlope = getSlope(aGuessT, mX1, mX2);
    if (currentSlope === 0.0) {
      return aGuessT;
    }
    const currentX = calcBezier(aGuessT, mX1, mX2) - aX;
    aGuessT -= currentX / currentSlope;
  }
  return aGuessT;
}

export type EasingFunction = (x: number) => number;

/**
 * Creates a cubic bezier easing function from 4 control points.
 */
export function createCubicBezier(mX1: number, mY1: number, mX2: number, mY2: number): EasingFunction {
  if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
    throw new Error("Bezier x values must be in [0, 1] range");
  }

  if (mX1 === mY1 && mX2 === mY2) {
    return (t: number) => t; // Linear
  }

  const sampleValues = new Float32Array(kSplineTableSize);
  for (let i = 0; i < kSplineTableSize; ++i) {
    sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
  }

  function getTForX(aX: number) {
    let intervalStart = 0.0;
    let currentSample = 1;
    const lastSample = kSplineTableSize - 1;

    for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
      intervalStart += kSampleStepSize;
    }
    --currentSample;

    const dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
    const guessForT = intervalStart + dist * kSampleStepSize;

    const initialSlope = getSlope(guessForT, mX1, mX2);
    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
    } else if (initialSlope === 0.0) {
      return guessForT;
    } else {
      return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
    }
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return calcBezier(getTForX(x), mY1, mY2);
  };
}

export const CLONE_POP_EASING = createCubicBezier(0.25, 1, 0.5, 1);
export const CLONE_CAMERA_EASING = createCubicBezier(0.16, 1, 0.3, 1);

