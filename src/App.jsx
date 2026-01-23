import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, Loader2, Lock, Unlock, ShieldAlert, Tag, Radio, Volume2 } from 'lucide-react';
import Pusher from 'pusher-js';

const CinemaApp = () => {
  // --- STATE UTAMA ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('initialized');
  
  // --- STATE ANTREAN (Agar suara tidak double) ---
  const [audioQueue, setAudioQueue] = useState([]);
  const isProcessingQueue = useRef(false);

  // --- STATE SETTING STUDIO (Dinamis per Studio) ---
  const [theaters, setTheaters] = useState([
    { id: 'kota1', name: 'KOTA 1', fileCode: '1', movieTitle: '', startTime: '00:15:00' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2', movieTitle: '', startTime: '00:15:00' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3', movieTitle: '', startTime: '00:15:00' },
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4', movieTitle: '', startTime: '00:15:00' },
  ]);

  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const updateTheater = (id, field, value) => {
    setTheaters(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- LOGIC: PUSHER WATCHER & AUTO-SYNC ---
  useEffect(() => {
    const pusher = new Pusher("0396bd8cd1f0bbf91a96", { cluster: "ap1", forceTLS: true });
    pusher.connection.bind('state_change', (states) => setConnectionStatus(states.current));
    
    const channel = pusher.subscribe('cinema-channel');
    channel.bind('trigger-audio', (data) => {
      // Normalisasi ID (Contoh: "KOTA 1" -> "kota1")
      const tId = data.studio.toLowerCase().replace(/[^a-z0-9]/g, '');
      const theater = theaters.find(t => t.id === tId);
      
      if (!theater) return;

      // 1. Logika Pintu Buka (Detik 25 sesuai script tampermu)
      if (data.type === 'pintu-buka') {
        addToAudioQueue(tId, 'open', `AUTO: Pintu ${theater.name}`);
      } 
      // 2. Logika Start Otomatis (Mencocokkan waktu Barco dengan input di UI)
      else if (data.type === 'sync-time' && data.time === theater.startTime) {
        addToAudioQueue(tId, 'start', `START: ${theater.movieTitle || theater.name}`);
      }
    });

    return () => { pusher.unsubscribe('cinema-channel'); pusher.disconnect(); };
  }, [theaters]);

  // --- QUEUE SYSTEM (Antrean Suara) ---
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
        audioRef.current.pause(); 
        setIsPlaying(false); 
        isProcessingQueue.current = false;
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      
      const file = action === 'open' ? `/pintu${theater.fileCode}.wav` : `/pertunjukan${theater.fileCode}.wav`;
      const newAudio = new Audio(file);

      newAudio.onended = () => { 
        setActiveId(null); 
        setIsPlaying(false); 
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      };

      audioRef.current = newAudio;
      audioRef.current.play().then(() => {
        setActiveId(targetId); 
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Autoplay diblokir! Klik layar dulu.");
        setIsPlaying(false); 
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      });
    }
  };

  const stopAll = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setActiveId(null); 
    setIsPlaying(false); 
    setAudioQueue([]); 
    isProcessingQueue.current = false;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative overflow-x-hidden">
      {isLocked && <div className="fixed inset-0 z-40 cursor-not-allowed"></div>}

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-4 relative z-50">
        <div className="flex items-center gap-4">
            <img src="/logo1.png" className={`h-12 w-auto ${isLocked ? 'opacity-50 grayscale' : ''}`} alt="Logo"/>
            <div>
                <h1 className="text-2xl font-black text-yellow-500 tracking-tighter uppercase">Cinema Control</h1>
                <div className="flex items-center gap-2">
                  <p className="text-slate-500 text-[10px] font-bold">
                      {isLocked ? <span className="text-red-400 flex items-center gap-1 animate-pulse"><ShieldAlert size={12}/> SYSTEM LOCKED</span> : "Hybrid Automation v10.0"}
                  </p>
                  <div className="flex items-center gap-1.5 ml-2 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[9px] font-black uppercase text-slate-300">{connectionStatus === 'connected' ? 'Online' : 'Offline'}</span>
                  </div>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsLocked(!isLocked)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-black text-xs transition-all ${isLocked ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isLocked ? <Unlock size={14}/> : <Lock size={14}/>} {isLocked ? 'OPEN UI' : 'LOCK UI'}
            </button>
            <button onClick={stopAll} className="px-4 py-2 rounded-lg border bg-red-900/40 hover:bg-red-800 text-red-200 border-red-800/50 text-xs font-black">STOP ALL</button>
        </div>
      </div>

      {/* JAM DIGITAL TENGAH */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="bg-slate-950 p-6 rounded-3xl border-2 border-cyan-500/20 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-30"></div>
            <h2 className="text-6xl font-mono font-black text-cyan-400 tracking-tighter drop-shadow-md">
                {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
            </h2>
            <p className="text-cyan-200/30 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* GRID STUDIO DENGAN SETTING */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-24 relative z-10">
        {theaters.map(t => (
          <div key={t.id} className={`p-5 rounded-2xl border-2 shadow-xl backdrop-blur-md transition-all ${t.id === 'suite' ? 'border-yellow-600/30 bg-yellow-900/10' : 'border-slate-700/50 bg-slate-800/50'}`}>
            
            <div className="flex justify-between items-center mb-3">
               <h2 className={`font-black uppercase text-[10px] tracking-[0.3em] ${t.id === 'suite' ? 'text-yellow-500' : 'text-slate-400'}`}>{t.name}</h2>
               <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-slate-700">
                  <Clock size={10} className="text-cyan-400"/>
                  <input 
                    type="text" 
                    value={t.startTime} 
                    onChange={(e) => updateTheater(t.id, 'startTime', e.target.value)}
                    disabled={isLocked}
                    className="bg-transparent text-[10px] font-mono text-cyan-400 w-14 outline-none border-none p-0 focus:text-white"
                  />
               </div>
            </div>

            <div className="relative mb-4">
               <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
               <input 
                 type="text" 
                 placeholder="Input Judul..." 
                 value={t.movieTitle}
                 onChange={(e) => updateTheater(t.id, 'movieTitle', e.target.value)}
                 disabled={isLocked}
                 className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-[11px] text-white outline-none focus:border-cyan-500 transition-all"
               />
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => toggleAudio(t.id, 'open')} 
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeId === `${t.id}-open` ? 'bg-emerald-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>
                Pintu Buka {activeId === `${t.id}-open` ? <Pause size={12}/> : <Play size={12}/>}
              </button>
              <button 
                onClick={() => toggleAudio(t.id, 'start')} 
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${activeId === `${t.id}-start` ? 'bg-cyan-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>
                Mulai Film {activeId === `${t.id}-start` ? <Pause size={12}/> : <Play size={12}/>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FLOATING INDICATOR ANTREAN */}
      {audioQueue.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
          <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-[0_20px_50px_rgba(16,185,129,0.4)] flex items-center justify-between border-2 border-white/20 backdrop-blur-md">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="bg-white/20 p-2 rounded-xl animate-spin"><Loader2 size={24}/></div>
              <div className="truncate">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1">Playing Now</p>
                <p className="font-black text-sm uppercase tracking-tighter truncate">{audioQueue[0].label}</p>
              </div>
            </div>
            <div className="bg-black/30 px-3 py-1.5 rounded-xl text-[10px] font-black font-mono">NEXT: {audioQueue.length - 1}</div>
          </div>
        </div>
      )}

      {/* REMINDER AUTOPLAY (Hanya Muncul Jika Belum Klik) */}
      <div className="fixed bottom-4 right-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full flex items-center gap-2">
        <Volume2 size={10}/> Klik Layar Jika Audio Tidak Bunyi
      </div>
    </div>
  );
};

export default CinemaApp;