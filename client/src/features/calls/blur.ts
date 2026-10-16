import type { ImageSegmenter } from '@mediapipe/tasks-vision';

export interface ProcessedTrack {
  track: MediaStreamTrack;
  stop: () => void;
}

// The person mask is computed on a small copy of the frame and scaled up smoothly.
const MASK_WIDTH = 256;
const MASK_HEIGHT = 144;
const BLUR_PX = 14;
const FPS = 24;

let segmenter: Promise<ImageSegmenter> | null = null;

/** Loads the segmentation model once (wasm and model are bundled, nothing is fetched from elsewhere). */
function loadSegmenter() {
  segmenter ??= (async () => {
    const [{ ImageSegmenter }, loader, binary, model] = await Promise.all([
      import('@mediapipe/tasks-vision'),
      import('@mediapipe/tasks-vision/vision_wasm_internal.js?url'),
      import('@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'),
      import('@/assets/mediapipe/selfie_segmenter.tflite?url'),
    ]);
    return ImageSegmenter.createFromOptions(
      { wasmLoaderPath: loader.default, wasmBinaryPath: binary.default },
      {
        baseOptions: { modelAssetPath: model.default, delegate: 'CPU' },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      },
    );
  })();
  segmenter.catch(() => (segmenter = null));
  return segmenter;
}

function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/** Wraps a camera track: everything except the person is blurred. */
export async function createBlurredTrack(camera: MediaStreamTrack): Promise<ProcessedTrack> {
  const model = await loadSegmenter();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([camera]);
  await video.play();

  const width = video.videoWidth || camera.getSettings().width || 640;
  const height = video.videoHeight || camera.getSettings().height || 360;
  const output = canvas(width, height);
  const person = canvas(width, height);
  const small = canvas(MASK_WIDTH, MASK_HEIGHT);
  const mask = canvas(MASK_WIDTH, MASK_HEIGHT);
  const out = output.getContext('2d')!;
  const personCtx = person.getContext('2d')!;
  const smallCtx = small.getContext('2d', { willReadFrequently: true })!;
  const maskCtx = mask.getContext('2d')!;
  const maskPixels = maskCtx.createImageData(MASK_WIDTH, MASK_HEIGHT);

  let stopped = false;
  let timer = 0;

  const frame = () => {
    if (stopped) return;
    if (video.readyState >= 2) {
      smallCtx.drawImage(video, 0, 0, MASK_WIDTH, MASK_HEIGHT);
      model.segmentForVideo(small, performance.now(), (result) => {
        const confidence = result.confidenceMasks?.[0]?.getAsFloat32Array();
        if (!confidence) return;
        for (let i = 0; i < confidence.length; i++) maskPixels.data[i * 4 + 3] = Math.round(confidence[i] * 255);
        maskCtx.putImageData(maskPixels, 0, 0);
      });

      // Blurred background …
      out.filter = `blur(${BLUR_PX}px)`;
      out.drawImage(video, 0, 0, width, height);
      out.filter = 'none';
      // … with the sharp person (frame masked by the scaled-up confidence mask) on top.
      personCtx.globalCompositeOperation = 'copy';
      personCtx.drawImage(video, 0, 0, width, height);
      personCtx.globalCompositeOperation = 'destination-in';
      personCtx.imageSmoothingEnabled = true;
      personCtx.drawImage(mask, 0, 0, width, height);
      out.drawImage(person, 0, 0);
    }
    timer = window.setTimeout(frame, 1000 / FPS);
  };
  frame();

  const track = output.captureStream(FPS).getVideoTracks()[0];
  return {
    track,
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
      track.stop();
      video.srcObject = null;
    },
  };
}
