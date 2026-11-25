import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Pause, RotateCcw, MessageSquare, Sparkles } from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';

interface VoiceTrack {
  id: 'query' | 'reply';
  title: string;
  speaker: string;
  speakerBadge: string;
  knText: string;
  enText: string;
  src: string;
}

export const FarmerVoicePlayer: React.FC = () => {
  const { lang } = useBhoomi();
  const [activeTrack, setActiveTrack] = useState<'query' | 'reply'>('query');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Use base-path aware URLs (works seamlessly under /bhoomi-ai/ on GitHub Pages or / locally)
  const basePath = import.meta.env.BASE_URL || '/';
  const cleanBase = basePath.endsWith('/') ? basePath : `${basePath}/`;

  const tracks: Record<'query' | 'reply', VoiceTrack> = {
    query: {
      id: 'query',
      title: lang === 'kn' ? 'ರೈತರ ಧ್ವನಿ ಪ್ರಶ್ನೆ (WhatsApp Voice)' : 'Farmer Voice Query (WhatsApp)',
      speaker: lang === 'kn' ? 'ಶ್ರೀ ವೆಂಕಟೇಶ್ (ರೈತರು)' : 'Sri Venkatesh (Farmer)',
      speakerBadge: lang === 'kn' ? 'ರೈತರ ಆಡಿಯೋ' : 'Farmer Audio',
      knText: '“ನನ್ನ ಜಮೀನಿನ ಪಹಣಿಯಲ್ಲಿ ಖಾತೆ ಹೆಸರು ಹಳೆಯದಾಗಿದೆ, ಬ್ಯಾಂಕ್ ಸಾಲ ಸಿಗುತ್ತಿಲ್ಲ. ಏನು ಮಾಡಬೇಕು?”',
      enText: '“My RTC still shows the old Khata name & bank loan is stalled. What should I do?”',
      src: `${cleanBase}farmer_query_kn.mp3`,
    },
    reply: {
      id: 'reply',
      title: lang === 'kn' ? 'ಭೂಮಿAI ಧ್ವನಿ ಮಾರ್ಗದರ್ಶನ (Voice Guidance)' : 'BhoomiAI Voice Guidance (Kannada)',
      speaker: lang === 'kn' ? 'ಭೂಮಿAI ಸಹಾಯಕ' : 'BhoomiAI Voice Assistant',
      speakerBadge: lang === 'kn' ? 'ಪರಿಹಾರ ಮಾರ್ಗದರ್ಶನ' : 'Remedy Voice Guide',
      knText: '“ಚಿಂತೆ ಮಾಡಬೇಡಿ. ನಿಮ್ಮ ಪಹಣಿ ಮತ್ತು ವಂಶವೃಕ್ಷ ಪರಿಶೀಲಿಸಿದ್ದೇವೆ. ಫಾರ್ಮ್ ಇಪ್ಪತ್ತೊಂದು ಅರ್ಜಿ ಸಿದ್ಧವಾಗಿದೆ; ಅಧಿಕಾರಿ ಅನುಮೋದನೆಯ ನಂತರ ಖಾತೆ ಬದಲಾವಣೆ ಪೂರ್ಣಗೊಳ್ಳುತ್ತದೆ.”',
      enText: '“Don’t worry. We verified your Pahani and family tree. Form 21 mutation draft is ready for officer approval.”',
      src: `${cleanBase}bhoomi_reply_kn.mp3`,
    },
  };

  const current = tracks[activeTrack];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [activeTrack]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log('Audio playback prevented', e));
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    // If query finishes, automatically switch to reply for a conversational demo!
    if (activeTrack === 'query') {
      setTimeout(() => {
        setActiveTrack('reply');
      }, 500);
    }
  };

  const formatSec = (sec: number) => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="rounded-2xl border-2 border-[#239B65]/40 bg-gradient-to-br from-[#0c2e26] via-[#123D32] to-[#071c17] p-4 text-white shadow-md">
      <audio
        ref={audioRef}
        src={current.src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onTimeUpdate}
        onEnded={onEnded}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#239B65] text-white shadow-xs">
            <Volume2 className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                <span>{lang === 'kn' ? 'ರೈತರ ಧ್ವನಿ ಸಮಾಲೋಚನೆ' : 'Kannada Voice Assistant'}</span>
                <span className="rounded-full bg-[#D6A84B] px-2 py-0.2 text-[10px] font-bold text-slate-900">
                  {lang === 'kn' ? 'ನೇರ ಆಡಿಯೋ' : 'Live Audio'}
                </span>
              </h3>
            </div>
            <p className="text-xs text-emerald-200/90 mt-0.5">
              {lang === 'kn'
                ? 'ಕಡಿಮೆ ಸಾಕ್ಷರತೆ ಮತ್ತು 2G ನೆಟ್‌ವರ್ಕ್ ರೈತರಿಗೆ ಧ್ವನಿ ಮೂಲಕ ನೇರ ಪರಿಹಾರ'
                : 'WhatsApp Voice & 2G phone path for smallholder farming families'}
            </p>
          </div>
        </div>

        {/* Track switch tabs */}
        <div className="flex items-center rounded-xl bg-black/30 p-1 border border-white/10 text-xs font-semibold">
          <button
            onClick={() => setActiveTrack('query')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer ${
              activeTrack === 'query'
                ? 'bg-[#239B65] text-white shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{lang === 'kn' ? '೧. ರೈತರ ಧ್ವನಿ' : '1. Farmer Query'}</span>
          </button>
          <button
            onClick={() => setActiveTrack('reply')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition cursor-pointer ${
              activeTrack === 'reply'
                ? 'bg-[#D6A84B] text-slate-900 font-bold shadow-xs'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{lang === 'kn' ? '೨. ಭೂಮಿAI ಉತ್ತರ' : '2. BhoomiAI Reply'}</span>
          </button>
        </div>
      </div>

      {/* Main Player Card */}
      <div className="mt-3.5 rounded-xl bg-black/25 p-3.5 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                activeTrack === 'query'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {current.speakerBadge}
            </span>
            <span className="text-xs font-bold text-slate-200">{current.speaker}</span>
          </div>
          <p className="text-sm font-semibold text-white leading-relaxed font-sans">
            {current.knText}
          </p>
          <p className="text-xs text-slate-300 italic">{current.enText}</p>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          <div className="text-right">
            <div className="font-mono text-xs font-bold text-emerald-300">
              {formatSec(currentTime)} / {formatSec(duration || (activeTrack === 'query' ? 5.2 : 12.0))}
            </div>
            <div className="text-[10px] text-slate-400">
              {activeTrack === 'query' ? 'kn-IN-Gagan' : 'kn-IN-Sapna'}
            </div>
          </div>

          <button
            onClick={togglePlay}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-slate-900 shadow-md transition hover:scale-105 cursor-pointer ${
              activeTrack === 'query' ? 'bg-[#239B65] text-white hover:bg-[#2ab677]' : 'bg-[#D6A84B] hover:bg-[#e4b759]'
            }`}
            title={isPlaying ? 'Pause' : 'Play Audio'}
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
