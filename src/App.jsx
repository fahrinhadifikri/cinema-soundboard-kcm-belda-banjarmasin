import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Clock, List, Sparkles, Loader2, 
  ClipboardPaste, Lock, Unlock, ShieldAlert, PlusCircle, Radio, Tag
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Pusher from 'pusher-js';

const CinemaApp = () => {
  // --- STATE UTAMA ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('initialized');
  const [audioQueue, setAudioQueue] = useState([]);
  const isProcessingQueue = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- STATE DATA STUDIO (DINAMIS) ---
  const [theaters, setTheaters] = useState([
    { id: 'kota1', name: 'KOTA 1', fileCode: '1', movieTitle: '', startTime: '00:15:00' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2', movieTitle: '', startTime: '00:15:00' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3', movieTitle: '', startTime: '00:15:00' },
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4', movieTitle: '', startTime: '00:15:00' },
  ]);

  const updateTheater = (id, field, value) => {
    setTheaters(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- JAM REALTIME ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- LOGIC: PUSHER WATCHER ---
  useEffect(() => {
    const pusher = new Pusher("0396bd8cd1f0bbf91a96", { cluster: "ap1" });
    pusher.connection.bind('state_change', (states) => setConnectionStatus(states.current));
    
    const channel = pusher.subscribe('cinema-channel');
    channel.bind('trigger-audio', (data) => {
      const tId = data.studio.toLowerCase().replace(/[^a-z0-9]/g, '');
      const theater = theaters.find(t => t.id === tId);
      if (!theater) return;

      // 1. Pintu Buka (Detik 19)
      if (data.type === 'pintu-buka') {
        addToAudioQueue(tId, 'open', `AUTO: Pintu ${theater.name}`);
      } 
      // 2. Start Otomatis (Match dengan StartTime di UI)
      else if (data.type === 'sync-time' && data.time === theater.startTime) {
        addToAudioQueue(tId, 'start', `START: ${theater.movieTitle || theater.name}`);
      }
    });

    return () => { pusher.unsubscribe('cinema-channel'); pusher.disconnect(); };
  }, [theaters]);

  const addToAudioQueue = (roomId, action, label) => {
    const newEntry = { id: Date.now() + Math.random(), roomId, action, label };
    setAudioQueue(prev => [...prev, newEntry]);
  };

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying && !isProcessingQueue.current) {
      const next = audioQueue[0];
      isProcessingQueue.current = true;
      toggleAudio(next.roomId, next.action, true);
    }
  }, [audioQueue, isPlaying]);

  const toggleAudio = (roomId, action, fromQueue = false) => {
    const targetId = `${roomId}-${action}`;
    const theater = theaters.find(t => t.id === roomId);
    if (!theater) return;

    if (activeId === targetId && isPlaying && !fromQueue) {
        audioRef.current.pause(); setIsPlaying(false); isProcessingQueue.current = false;
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      const file = action === 'open' ? `/pintu${theater.fileCode}.wav` : `/pertunjukan${theater.fileCode}.wav`;
      const newAudio = new Audio(file);
      newAudio.onended = () => { 
        setActiveId(null); setIsPlaying(false); isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      };
      audioRef.current = newAudio;
      audioRef.current.play().catch(() => { setIsPlaying(false); isProcessingQueue.current = false; });
      setActiveId(targetId); setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setActiveId(null); setIsPlaying(false); setAudioQueue([]); isProcessingQueue.current = false;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative overflow-x-hidden">
      {isLocked && <div className="fixed inset-0 z-40 cursor-not-allowed bg-transparent"></div>}

      {/* HEADER v10.0 */}
      <div className="relative z-50 max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-4">
            <div className="relative">
                <img src="/logo1.png" className={`h-12 w-auto transition-all ${isLocked ? 'opacity-50 grayscale' : ''}`} alt="Logo"/>
                {isLocked && <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg animate-bounce"><Lock size={16} /></div>}
            </div>
            <div>
                <h1 className="text-2xl font-black text-yellow-500 tracking-tighter">CINEMA CONTROL</h1>
                <div className="flex items-center gap-2">
                  <p className="text-slate-400 text-[10px] font-bold">
                      {isLocked ? <span className="text-red-400 flex items-center gap-1 uppercase tracking-widest animate-pulse"><ShieldAlert size={12}/> Locked</span> : "AUTO-HYBRID V10.0"}
                  </p>
                  <div className="flex items-center gap-1.5 ml-2 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                      {connectionStatus === 'connected' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsLocked(!isLocked)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-black text-xs transition-all ${isLocked ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isLocked ? <Unlock size={14}/> : <Lock size={14}/>} {isLocked ? 'OPEN UI' : 'LOCK UI'}
            </button>
            <button onClick={stopAudio} className="px-4 py-2 rounded-lg border bg-red-900/40 hover:bg-red-800 text-red-200 border-red-800/50 text-xs font-black">STOP ALL</button>
        </div>
      </div>

      {/* GRID SOUNDBOARD DINAMIS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-24 relative z-10">
        {theaters.map(t => (
          <div key={t.id} className={`p-5 rounded-2xl border-2 shadow-xl backdrop-blur-md transition-all ${t.id === 'suite' ? 'border-yellow-600/30 bg-yellow-900/5' : 'border-slate-700/50 bg-slate-800/50'}`}>
            
            {/* Header Studio & Input Timing */}
            <div className="flex justify-between items-center mb-3">
               <h2 className={`font-black uppercase text-[10px] tracking-[0.3em] ${t.id === 'suite' ? 'text-yellow-500' : 'text-slate-400'}`}>{t.name}</h2>
               <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-slate-700">
                  <Clock size={10} className="text-cyan-400"/>
                  <input 
                    type="text" 
                    value={t.startTime} 
                    onChange={(e) => updateTheater(t.id, 'startTime', e.target.value)}
                    className="bg-transparent text-[10px] font-mono text-cyan-400 w-14 outline-none border-none p-0"
                  />
               </div>
            </div>

            {/* Input Judul Film */}
            <div className="relative mb-4 group">
               <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-all"/>
               <input 
                 type="text" 
                 placeholder="Input Judul..." 
                 value={t.movieTitle}
                 onChange={(e) => updateTheater(t.id, 'movieTitle', e.target.value)}
                 className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[11px] text-white outline-none focus:border-indigo-500 transition-all"
               />
            </div>

            <div className="space-y-2">
              <button onClick={() => toggleAudio(t.id, 'open')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeId === `${t.id}-open` ? 'bg-emerald-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>
                BUKA PINTU {activeId === `${t.id}-open` ? <Pause size={14}/> : <Play size={14}/>}
              </button>
              <button onClick={() => toggleAudio(t.id, 'start')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeId === `${t.id}-start` ? 'bg-cyan-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>
                MULAI FILM {activeId === `${t.id}-start` ? <Pause size={14}/> : <Play size={14}/>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER ANTREAN v10.0 */}
      {audioQueue.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
          <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center justify-between border-2 border-white/20">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl animate-spin"><Loader2 size={24}/></div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">Playing Now</p>
                <p className="font-black text-sm uppercase tracking-tighter truncate">{audioQueue[0].label}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CinemaApp;