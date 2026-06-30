/** Attach a MediaStream to a <video> and call play() (required on many mobile browsers). */
export function attachVideoStream(videoEl, stream) {
  if (!videoEl) return;
  videoEl.srcObject = stream || null;
  if (stream?.getTracks?.().length) {
    videoEl.play().catch((err) => {
      console.warn('[attachVideoStream] play() failed:', err.message);
    });
  }
}
