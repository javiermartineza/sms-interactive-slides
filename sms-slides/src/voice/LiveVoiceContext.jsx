import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// URL del backend FastAPI (cambiar si se despliega a producción)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8765';

const MAX_REC_SEC = 5;
const MIN_REC_SEC = 3;

const LiveVoiceContext = createContext(null);

export function useLiveVoice() {
  const ctx = useContext(LiveVoiceContext);
  if (!ctx) throw new Error('useLiveVoice debe usarse dentro de LiveVoiceProvider');
  return ctx;
}

// ─── Codifica un AudioBuffer a Blob WAV PCM-16 mono ────────────────────────
function audioBufferToWavBlob(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  if (audioBuffer.numberOfChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) mono[i] = 0.5 * (ch0[i] + ch1[i]);
  }
  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < length; i++) {
    let s = Math.max(-1, Math.min(1, mono[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(off, s, true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function LiveVoiceProvider({ children }) {
  // 'idle' | 'recording' | 'processing' | 'ready' | 'error'
  const [status, setStatus] = useState('idle');
  const [recElapsed, setRecElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [session, setSession] = useState(null);
  // session = { sessionId, sampleRate, duration, nTracks, nParciales, audio: {...full URLs}, images: {...full URLs} }

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recStartRef = useRef(0);
  const recTimerRef = useRef(null);
  const recAutoStopRef = useRef(null);
  const audioCtxRef = useRef(null);

  const cleanupRecording = useCallback(() => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (recAutoStopRef.current) { clearTimeout(recAutoStopRef.current); recAutoStopRef.current = null; }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecording();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [cleanupRecording]);

  const ensureCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  async function processBlob(blob) {
    setStatus('processing');
    try {
      const ctx = ensureCtx();
      const arrBuf = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrBuf.slice(0));
      const wavBlob = audioBufferToWavBlob(decoded);

      const form = new FormData();
      form.append('audio', wavBlob, 'recording.wav');

      const resp = await fetch(`${BACKEND_URL}/process-sms`, { method: 'POST', body: form });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Backend ${resp.status}: ${txt}`);
      }
      const data = await resp.json();

      const fullAudio = {};
      for (const [k, u] of Object.entries(data.audio || {})) {
        fullAudio[k] = u.startsWith('http') ? u : `${BACKEND_URL}${u}`;
      }
      const fullImages = {};
      for (const [k, u] of Object.entries(data.images || {})) {
        fullImages[k] = u.startsWith('http') ? u : `${BACKEND_URL}${u}`;
      }

      setSession({
        sessionId: data.session_id,
        sampleRate: data.sample_rate,
        duration: data.duration,
        nTracks: data.n_tracks,
        nParciales: data.n_parciales,
        audio: fullAudio,
        images: fullImages,
      });
      setStatus('ready');
    } catch (err) {
      setErrorMsg(String(err.message || err));
      setStatus('error');
    }
  }

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    setSession(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const chunks = recordedChunksRef.current;
        const mime = mr.mimeType || 'audio/webm';
        cleanupRecording();
        const blob = new Blob(chunks, { type: mime });
        await processBlob(blob);
      };

      mr.start();
      setStatus('recording');
      recStartRef.current = performance.now();
      setRecElapsed(0);
      recTimerRef.current = setInterval(() => {
        setRecElapsed((performance.now() - recStartRef.current) / 1000);
      }, 80);
      recAutoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
        }
      }, MAX_REC_SEC * 1000);
    } catch (err) {
      setErrorMsg(`No se pudo acceder al micrófono: ${err.message || err}`);
      setStatus('error');
      cleanupRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupRecording, ensureCtx]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  const reset = useCallback(() => {
    cleanupRecording();
    setSession(null);
    setStatus('idle');
    setErrorMsg(null);
    setRecElapsed(0);
  }, [cleanupRecording]);

  const value = {
    status,
    session,
    errorMsg,
    recElapsed,
    minRecSec: MIN_REC_SEC,
    maxRecSec: MAX_REC_SEC,
    startRecording,
    stopRecording,
    reset,
    getAudioContext: ensureCtx,
  };

  return <LiveVoiceContext.Provider value={value}>{children}</LiveVoiceContext.Provider>;
}
