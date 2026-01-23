import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Clock, List, Sparkles, Loader2, 
  ClipboardPaste, Lock, Unlock, ShieldAlert, PlusCircle, Radio 
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
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

  // --- DATA STUDIO DINAMIS (Bisa diedit di UI) ---
  const [theaters, setTheaters] = useState([
    { id: 'kota1', name: 'KOTA 1', fileCode: '1', movieTitle: '', startTime: '00:15:00' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2', movieTitle: '', startTime: '00:15:00' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3', movieTitle: '', startTime: '00:15:00' },
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4', movieTitle: '', startTime: '00:15:00' },
  ]);

  const updateTheater = (id, field, value) => {
    setTheaters(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

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

      // 1. Logika Pintu Buka (Tetap di Detik 19)
      if (data.type === 'pintu-buka') {
        addToAudioQueue(tId, 'open', `AUTO: Pintu ${theater.name}`);
      } 
      // 2. Logika Start Otomatis (Mencocokkan waktu Barco dengan input UI)
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
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans">
      <div className="max-w-6xl mx-auto mb-8 border-b border-slate-700 pb-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo1.png" className="h-10 w-auto" alt="Logo"/>
          <div>
            <h1 className="text-xl font-black text-yellow-500">CINEMA CONTROL</h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Hybrid Automation</span>
              <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsLocked(!isLocked)} className="px-4 py-2 bg-slate-800 rounded-lg text-xs font-bold border border-slate-700">
            {isLocked ? <Unlock size={14}/> : <Lock size={14}/>}
          </button>
          <button onClick={stopAudio} className="px-4 py-2 bg-red-900/50 text-red-200 rounded-lg text-xs font-bold border border-red-800">STOP ALL</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
        {theaters.map(t => (
          <div key={t.id} className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">{t.name}</span>
              <div className="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-slate-700">
                <Clock size={12} className="text-cyan-500"/>
                <input type="text" value={t.startTime} onChange={(e) => updateTheater(t.id, 'startTime', e.target.value)} disabled={isLocked} className="bg-transparent text-[10px] font-mono text-cyan-400 w-16 outline-none"/>
              </div>
            </div>
            <input type="text" value={t.movieTitle} onChange={(e) => updateTheater(t.id, 'movieTitle', e.target.value)} disabled={isLocked} placeholder="Ketik Judul Film..." className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm mb-4 outline-none focus:border-cyan-500"/>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => toggleAudio(t.id, 'open')} className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeId === `${t.id}-open` ? 'bg-emerald-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>Buka Pintu</button>
              <button onClick={() => toggleAudio(t.id, 'start')} className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeId === `${t.id}-start` ? 'bg-cyan-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>Mulai Film</button>
            </div>
          </div>
        ))}
      </div>

      {audioQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50 border-2 border-white/20 animate-bounce">
          <Loader2 className="animate-spin" size={18}/>
          <span className="text-xs font-black uppercase tracking-widest">{audioQueue[0].label}</span>
        </div>
      )}
    </div>
  );
};

export default CinemaApp;