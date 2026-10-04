import React, { useState, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Sparkles } from 'lucide-react';

interface AudioSnippetPlayerProps {
  segmentId: string;
  transcript: string;
  durationSec: number;
  audioBase64?: string;
  flagType?: string;
}

export default function AudioSnippetPlayer({
  segmentId,
  transcript,
  durationSec,
  audioBase64,
  flagType
}: AudioSnippetPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.warn("Audio play prevented:", e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setPlaybackTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setPlaybackTime(0);
  };

  const progressPercent = durationSec > 0 ? Math.min(100, (playbackTime / durationSec) * 100) : 0;

  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2 text-xs">
      {/* Hidden native audio tag */}
      {audioBase64 && (
        <audio
          ref={audioRef}
          src={audioBase64}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      )}

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={!audioBase64}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer shrink-0 shadow-xs
          ${isPlaying 
            ? 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-300' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95'}`}
        title={audioBase64 ? (isPlaying ? "Pause speech audio" : "Play speech audio to verify transcription") : "Audio loading..."}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {/* Progress & Waveform Indicator */}
      <div className="flex-1 min-w-[140px]">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mb-1">
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <Volume2 className="w-3 h-3 text-indigo-500" />
            Bengali Speech Snippet
            {flagType && (
              <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] 
                ${flagType === 'MISHEAR' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                {flagType} Check
              </span>
            )}
          </span>
          <span>
            {playbackTime.toFixed(1)}s / {durationSec.toFixed(1)}s
          </span>
        </div>

        {/* Dynamic progress bar */}
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden relative cursor-pointer"
             onClick={(e) => {
               if (!audioRef.current || !durationSec) return;
               const rect = e.currentTarget.getBoundingClientRect();
               const clickX = e.clientX - rect.left;
               const newTime = (clickX / rect.width) * durationSec;
               audioRef.current.currentTime = newTime;
               setPlaybackTime(newTime);
             }}>
          <div
            className={`h-full transition-all duration-75 rounded-full ${isPlaying ? 'bg-amber-500' : 'bg-indigo-600'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
