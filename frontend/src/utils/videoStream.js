function streamTrackKey(stream) {
  if (!stream?.getTracks) return '';
  return stream
    .getTracks()
    .map((t) => `${t.id}:${t.readyState}`)
    .sort()
    .join('|');
}

/** Attach a MediaStream to a <video> and call play() (required on many mobile browsers). */
export function attachVideoStream(videoEl, stream) {
  if (!videoEl) return;

  const nextKey = streamTrackKey(stream);
  const prevKey = videoEl.dataset.streamKey || '';

  // Avoid reassigning srcObject when tracks are unchanged — that interrupts play().
  if (nextKey && nextKey === prevKey) {
    if (videoEl.paused && stream?.getTracks?.().some((t) => t.readyState === 'live')) {
      videoEl.play().catch(() => {});
    }
    return;
  }

  videoEl.dataset.streamKey = nextKey;
  videoEl.srcObject = stream || null;

  if (!stream?.getTracks?.().length) return;

  const playPromise = videoEl.play();
  if (!playPromise) return;

  playPromise.catch((err) => {
    const msg = err?.message || '';
    if (err?.name === 'AbortError' || /interrupted by a new load/i.test(msg)) return;
    console.warn('[attachVideoStream] play() failed:', msg);
  });
}
