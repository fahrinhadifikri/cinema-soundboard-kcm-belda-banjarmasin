import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Clock, Loader2, Lock, Unlock, ShieldAlert, Tag, Activity, Signal, WifiOff } from 'lucide-react';
import Pusher from 'pusher-js';

const CinemaApp = () => {
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [connectionStatus, setConnectionStatus] = useState('initialized');
  const [audioQueue, setAudioQueue] = useState([]);
  const isProcessingQueue = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // DATA TEATER & STATUS KONEKSI
  // fileCode: Identitas file audio (misal: pintu2.wav untuk KOTA 2)
  const [theaters, setTheaters] = useState([
    { id: 'KOTA-1', name: 'KOTA 1', fileCode: '1', movieTitle: '', startTime: '00:15:00', lastSeen: '-', connected: false },
    { id: 'KOTA 2', name: 'KOTA 2', fileCode: '2', movieTitle: '', startTime: '00:15:00', lastSeen: '-', connected: false },
    { id: 'KOTA-3', name: 'KOTA 3', fileCode: '3', movieTitle: '', startTime: '00:15:00', lastSeen: '-', connected: false },
    { id: 'KOTA-SUITE-1', name: 'PREMIERE SUITE', fileCode: '4', movieTitle: '', startTime: '00:15:00', lastSeen: '-', connected: false },
  ]);

  // Ref untuk akses state terbaru di dalam callback listener
  const theatersRef = useRef(theaters);

  useEffect(() => {
    theatersRef.current = theaters;
  }, [theaters]);

  // Timer Jam Besar
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- INTEGRASI PUSHER (LISTENER) ---
  useEffect(() => {
    Pusher.logToConsole = true; // Aktifkan log browser untuk debugging

    // KREDENSIAL PUSHER (Sesuai data yang kamu berikan)
    const pusher = new Pusher("fe598cf7eb50135b39dd", { 
      cluster: "ap1", 
      forceTLS: true
    });

    // Cek Status Koneksi Internet/Socket
    pusher.connection.bind('state_change', (states) => {
      setConnectionStatus(states.current);
    });
    
    // Subscribe ke Channel Cinema
    const channel = pusher.subscribe('cinema-channel');
    
    // LOGIKA SAAT MENERIMA SINYAL DARI BARCO
    channel.bind('trigger-audio', (data) => {
      console.log("[PUSHER EVENT]", data);

      // 1. Update Visual Indikator Sinyal (Hijau)
      setTheaters(prev => prev.map(t => {
          if (t.id === data.studio) {
              return { ...t, lastSeen: data.time, connected: true };
          }
          return t;
      }));

      // 2. Cek Logika Trigger Audio
      const currentTheaters = theatersRef.current;
      const theater = currentTheaters.find(t => t.id === data.studio);
      
      if (!theater) return;

      // Bersihkan spasi string agar perbandingan akurat
      const signalTime = data.time.trim(); 
      const targetTime = theater.startTime.trim();

      // DEBUG LOG
      // console.log(`Cek Trigger: ${theater.name} | Sinyal: ${signalTime} vs Target: ${targetTime}`);

      // TRIGGER: Pintu Buka
      if (data.type === 'pintu-buka') {
        addToAudioQueue(theater.id, 'open', `AUTO: Pintu ${theater.name}`);
      } 
      // TRIGGER: Mulai Film (Hanya jika waktu cocok dengan Target)
      else if (data.type === 'sync-time') {
         if (signalTime === targetTime) {
             addToAudioQueue(theater.id, 'start', `START: ${theater.movieTitle || theater.name}`);
         }
      }
    });

    return () => { 
        pusher.unsubscribe('cinema-channel'); 
        pusher.disconnect(); 
    };
  }, []);

  // Update Data Input Theater
  const updateTheater = (id, field, value) => {
    setTheaters(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // --- AUDIO SYSTEM & QUEUE ---
  const addToAudioQueue = (roomId, action, label) => {
    setAudioQueue(prev => {
        // Cegah spam trigger ganda dalam 5 detik
        const isDuplicate = prev.some(q => q.roomId === roomId && q.action === action && (Date.now() - q.id < 5000));
        if (isDuplicate) return prev;
        return [...prev, { id: Date.now(), roomId, action, label }];
    });
  };

  // Processor Queue
  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying && !isProcessingQueue.current) {
      const next = audioQueue[0];
      isProcessingQueue.current = true;
      toggleAudio(next.roomId, next.action, true);
    }
  }, [audioQueue, isPlaying]);

  // Pemutar Audio Utama
  const toggleAudio = (roomId, action, fromQueue = false) => {
    const targetId = `${roomId}-${action}`;
    const theater = theaters.find(t => t.id === roomId);
    if (!theater) return;

    // Jika tombol ditekan saat sedang main -> Stop
    if (activeId === targetId && isPlaying && !fromQueue) {
        if(audioRef.current) audioRef.current.pause(); 
        setIsPlaying(false); 
        setActiveId(null);
        isProcessingQueue.current = false;
    } else {
      // Setup Audio Baru
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      
      // LOGIKA PEMILIHAN FILE AUDIO
      // Pastikan file: pintu1.wav, pintu2.wav, pertunjukan1.wav, dll ada di folder public
      const file = action === 'open' ? `/pintu${theater.fileCode}.wav` : `/pertunjukan${theater.fileCode}.wav`;
      
      const newAudio = new Audio(file);
      
      newAudio.onended = () => { 
        setActiveId(null); 
        setIsPlaying(false); 
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1)); // Hapus dari antrian
      };
      
      newAudio.onerror = (e) => {
        console.error("Gagal memutar audio:", file, e);
        setIsPlaying(false);
        setActiveId(null);
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      };

      audioRef.current = newAudio;
      audioRef.current.play().then(() => {
        setActiveId(targetId); 
        setIsPlaying(true);
      }).catch((e) => {
        console.error("Audio Play Blocked/Error:", e);
        setIsPlaying(false); 
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative">
      {isLocked && <div className="fixed inset-0 z-40 bg-transparent cursor-not-allowed"></div>}

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-4 relative z-50">
        <div className="flex items-center gap-4">
            <img src="/logo1.png" className={`h-12 w-auto ${isLocked ? 'opacity-50 grayscale' : ''}`} alt="Logo" onError={(e) => e.target.style.display = 'none'}/>
            <div>
                <h1 className="text-2xl font-black text-yellow-500 tracking-tighter uppercase leading-none">Cinema Control</h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-slate-500 text-[10px] font-bold">
                      {isLocked ? <span className="text-red-400 flex items-center gap-1 animate-pulse tracking-widest leading-none"><ShieldAlert size={12}/> LOCKED</span> : "V10.2 MONITORING"}
                  </p>
                  <div className="flex items-center gap-1.5 ml-2 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 shadow-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-[9px] font-black uppercase text-slate-300 tracking-widest leading-none">
                      {connectionStatus === 'connected' ? 'Online' : connectionStatus}
                    </span>
                  </div>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsLocked(!isLocked)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-black text-xs transition-all ${isLocked ? 'bg-red-600 border-red-500 text-white shadow-lg' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isLocked ? <Unlock size={14}/> : <Lock size={14}/>} {isLocked ? 'OPEN UI' : 'LOCK UI'}
            </button>
            <button onClick={() => { if(audioRef.current) audioRef.current.pause(); setIsPlaying(false); setAudioQueue([]); }} className="px-4 py-2 rounded-lg border bg-red-900/40 hover:bg-red-800 text-red-200 border-red-800/50 text-xs font-black">STOP ALL</button>
        </div>
      </div>

      {/* BIG CLOCK */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="bg-slate-950 p-8 rounded-3xl border-2 border-cyan-500/10 text-center shadow-2xl relative">
            <h2 className="text-7xl font-mono font-black text-cyan-400 tracking-tighter drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
            </h2>
            <p className="text-cyan-200/20 text-[10px] font-black uppercase tracking-[0.3em] mt-3">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
        </div>
      </div>

      {/* THEATER CARDS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-24 relative z-10">
        {theaters.map(t => (
          <div key={t.id} className={`p-5 rounded-2xl border-2 shadow-xl transition-all ${t.id === 'KOTA-SUITE-1' ? 'border-yellow-600/30 bg-yellow-900/10' : 'border-slate-700/50 bg-slate-800/50'}`}>
            
            {/* Header Card & Signal Status */}
            <div className="flex justify-between items-center mb-3">
               <h2 className={`font-black uppercase text-[10px] tracking-[0.3em] ${t.id === 'KOTA-SUITE-1' ? 'text-yellow-500' : 'text-slate-400'}`}>{t.name}</h2>
               
               {/* INDIKATOR SINYAL BARCO */}
               <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 ${t.connected ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-black/40'}`}>
                  {t.connected ? <Signal size={10} className="text-emerald-500 animate-pulse"/> : <WifiOff size={10} className="text-red-500"/>}
                  <span className="text-[10px] font-mono font-bold text-slate-300">{t.lastSeen}</span>
               </div>
            </div>

            {/* Input Waktu Target */}
            <div className="flex items-center gap-2 mb-2 bg-black/20 p-2 rounded-lg border border-slate-700/50">
               <Clock size={12} className="text-cyan-400"/>
               <span className="text-[9px] text-slate-500 font-bold">TARGET:</span>
               <input type="text" value={t.startTime} onChange={(e) => updateTheater(t.id, 'startTime', e.target.value)} disabled={isLocked} className="bg-transparent text-sm font-mono text-white w-full outline-none border-none p-0 font-bold text-right"/>
            </div>

            {/* Input Judul */}
            <div className="relative mb-4">
               <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/>
               <input type="text" placeholder="Input Judul..." value={t.movieTitle} onChange={(e) => updateTheater(t.id, 'movieTitle', e.target.value)} disabled={isLocked} className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2.5 text-[11px] text-white outline-none focus:border-cyan-500/50 font-bold"/>
            </div>

            {/* Manual Control Buttons */}
            <div className="space-y-2">
              <button onClick={() => toggleAudio(t.id, 'open')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all shadow-lg ${activeId === `${t.id}-open` ? 'bg-emerald-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>Pintu Buka {activeId === `${t.id}-open` ? <Pause size={12}/> : <Play size={12}/>}</button>
              <button onClick={() => toggleAudio(t.id, 'start')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all shadow-lg ${activeId === `${t.id}-start` ? 'bg-cyan-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>Mulai Film {activeId === `${t.id}-start` ? <Pause size={12}/> : <Play size={12}/>}</button>
            </div>
          </div>
        ))}
      </div>

      {/* POPUP QUEUE (Muncul saat audio akan berbunyi otomatis) */}
      {audioQueue.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-bounce">
          <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-2xl flex items-center justify-between border-2 border-white/20 backdrop-blur-md">
            <div className="flex items-center gap-4 overflow-hidden text-left">
              <div className="bg-white/20 p-2 rounded-xl animate-spin text-white"><Loader2 size={24}/></div>
              <div className="truncate">
                <p className="text-[8px] font-black uppercase tracking-widest opacity-70 mb-1 leading-none">Playing Now</p>
                <p className="font-black text-sm uppercase tracking-tighter truncate leading-none">{audioQueue[0].label}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CinemaApp;