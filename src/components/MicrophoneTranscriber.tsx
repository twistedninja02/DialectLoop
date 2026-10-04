import React, { useState, useRef } from 'react';
import { Mic, Square, Loader2, Sparkles, Volume2, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { AudioSegment } from '../types';

interface MicrophoneTranscriberProps {
  districtCluster: string;
  onTranscriptReady: (segment: AudioSegment) => void;
}

export default function MicrophoneTranscriber({
  districtCluster,
  onTranscriptReady
}: MicrophoneTranscriberProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [asrEngine, setAsrEngine] = useState<'whisper' | 'kaldi' | 'gemini'>('whisper');
  const [whisperModel, setWhisperModel] = useState<'large-v3' | 'medium' | 'small'>('large-v3');
  const [kaldiModel, setKaldiModel] = useState<'tdnn-f' | 'chain-lattice' | 'gmm-triphone'>('tdnn-f');
  const [modelUsed, setModelUsed] = useState<string>('Whisper-large-v3 (github.com/openai/whisper)');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setErrorMessage(null);
    setTranscribedText(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop audio tracks
        stream.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);

        // Convert Blob to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = reader.result as string;
          setAudioBase64(b64);
          await transcribeRecordedAudio(b64, audioBlob.type);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // collect 250ms chunks
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage("Microphone access denied or audio input device not found.");
      console.warn("Microphone recording error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const transcribeRecordedAudio = async (base64Audio: string, mime: string) => {
    setIsTranscribing(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: mime,
          contextPrompt: `Target district dialect context: ${districtCluster}`,
          asrEngine,
          whisperModel,
          kaldiModel
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server transcription failed");
      }

      const data = await res.json();
      setTranscribedText(data.transcript);
      setModelUsed(
        data.modelUsed || 
        (asrEngine === 'whisper' 
          ? `Whisper-${whisperModel} (github.com/openai/whisper)` 
          : asrEngine === 'kaldi' 
            ? `Kaldi-${kaldiModel.toUpperCase()} (github.com/kaldi-asr/kaldi)` 
            : "gemini-3.5-transcribe")
      );
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to transcribe speech audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAddToBatch = () => {
    if (!transcribedText) return;

    const newSeg: AudioSegment = {
      segment_id: `mic_${Date.now().toString().slice(-6)}`,
      district: districtCluster || 'Dhaka',
      duration: Math.max(2.5, recordingSeconds),
      transcript: transcribedText,
      speaker_id: 'user_mic_live',
      audio_blob_b64: audioBase64 || undefined
    };

    onTranscriptReady(newSeg);
    setTranscribedText(null);
    setAudioUrl(null);
    setAudioBase64(null);
  };

  return (
    <div className="bg-white border border-indigo-150 rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-200">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 font-display flex items-center gap-2">
              Live Microphone Speech Transcriber
              <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                ASR: {asrEngine === 'whisper' ? `Whisper ${whisperModel}` : asrEngine === 'kaldi' ? `Kaldi ${kaldiModel.toUpperCase()}` : 'Gemini 3.5'}
              </span>
            </h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-slate-500">
                Language: <strong className="text-slate-700">Bengali (bn)</strong>
              </span>
              {asrEngine === 'whisper' && (
                <a
                  href="https://github.com/openai/whisper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  title="OpenAI Whisper GitHub Open-Source Repository"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  github.com/openai/whisper
                </a>
              )}
              {asrEngine === 'kaldi' && (
                <a
                  href="https://github.com/kaldi-asr/kaldi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1 font-semibold"
                  title="Kaldi Speech Recognition Toolkit GitHub Repository"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  github.com/kaldi-asr/kaldi
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Engine Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setAsrEngine('whisper')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${asrEngine === 'whisper' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Whisper (GitHub)
          </button>
          <button
            type="button"
            onClick={() => setAsrEngine('kaldi')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${asrEngine === 'kaldi' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Kaldi (GitHub)
          </button>
          <button
            type="button"
            onClick={() => setAsrEngine('gemini')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${asrEngine === 'gemini' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Gemini
          </button>
        </div>

        {isRecording && (
          <div className="flex items-center gap-1.5 text-rose-600 font-mono text-xs font-bold bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            Rec: {recordingSeconds}s
          </div>
        )}
      </div>

      {/* Whisper Model Configuration Row when Whisper is selected */}
      {asrEngine === 'whisper' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-indigo-50/40 rounded-xl border border-indigo-100 text-[11px]">
          <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>OpenAI Whisper Model Size:</span>
          </div>
          <div className="flex items-center gap-2">
            {(['large-v3', 'medium', 'small'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setWhisperModel(m)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${whisperModel === m ? 'bg-indigo-600 text-white font-bold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {m}
              </button>
            ))}
            <span className="text-[10px] font-mono text-slate-400">| git+https://github.com/openai/whisper.git</span>
          </div>
        </div>
      )}

      {/* Kaldi Model Configuration Row when Kaldi is selected */}
      {asrEngine === 'kaldi' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-emerald-50/50 rounded-xl border border-emerald-150 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-950 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kaldi Acoustic & Alignment Pipeline:</span>
          </div>
          <div className="flex items-center gap-2">
            {([
              { id: 'tdnn-f', label: 'TDNN-F Chain' },
              { id: 'chain-lattice', label: 'Lattice Posteriors' },
              { id: 'gmm-triphone', label: 'Triphone GMM' }
            ] as const).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKaldiModel(k.id as any)}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition ${kaldiModel === k.id ? 'bg-emerald-700 text-white font-bold shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {k.label}
              </button>
            ))}
            <span className="text-[10px] font-mono text-emerald-700">| git+https://github.com/kaldi-asr/kaldi.git</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mic Input Trigger & Audio Wave Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isTranscribing}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 hover:shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Mic className="w-3.5 h-3.5" />
              Start Mic Audio Input
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 hover:shadow-md transition cursor-pointer ring-2 ring-rose-300"
            >
              <Square className="w-3.5 h-3.5 text-rose-400" />
              Stop & Transcribe ({asrEngine === 'whisper' ? `Whisper ${whisperModel}` : asrEngine === 'kaldi' ? `Kaldi ${kaldiModel}` : 'Gemini'})
            </button>
          )}

          <span className="text-[11px] text-slate-500 font-mono">
            {isRecording 
              ? "Speaking into mic... Click stop when finished." 
              : isTranscribing 
                ? asrEngine === 'whisper' 
                  ? `Transcribing via Whisper ${whisperModel} (github.com/openai/whisper)...` 
                  : asrEngine === 'kaldi'
                    ? `Decoding phone lattices via Kaldi ${kaldiModel} (github.com/kaldi-asr/kaldi)...`
                    : "Calling gemini-3.5-transcribe..." 
                : `Ready to record. ASR engine: ${asrEngine === 'whisper' ? `Whisper (${whisperModel})` : asrEngine === 'kaldi' ? `Kaldi (${kaldiModel})` : 'Gemini'}`}
          </span>
        </div>

        {audioUrl && (
          <div className="flex items-center gap-2">
            <audio src={audioUrl} controls className="h-7 w-44" />
          </div>
        )}
      </div>

      {/* Transcription Output Display */}
      {isTranscribing && (
        <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-150 flex items-center justify-center gap-2 text-xs text-indigo-700 font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Transcribing Bengali dialect audio via <strong className="font-mono">gemini-3.5-transcribe</strong>...</span>
        </div>
      )}

      {transcribedText && !isTranscribing && (
        <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900 flex items-center gap-1.5 font-display">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Transcribed Output ({modelUsed})
            </span>
            <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
              Target Cluster: {districtCluster}
            </span>
          </div>

          <p className="text-sm font-semibold text-slate-800 tracking-tight leading-relaxed bg-white p-2.5 rounded-lg border border-emerald-150 font-sans">
            "{transcribedText}"
          </p>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleAddToBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 hover:shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Segment to Current Batch Run
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
