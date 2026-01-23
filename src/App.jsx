import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Volume2, Clock, CalendarClock, Trash2, List, 
  FileJson, Sparkles, Loader2, ClipboardPaste, Lock, Unlock, 
  ShieldAlert, PlusCircle, Radio 
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Pusher from 'pusher-js';

const CinemaApp = () => {
  // --- STATE UTAMA ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const [audioQueue, setAudioQueue] = useState([]);
  const isProcessingQueue = useRef(false);
  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scheduleQueue, setScheduleQueue] = useState([]);
  
  // State Input & API
  const [inputTime, setInputTime] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [inputTarget, setInputTarget] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem("GEMINI_KEY") || "");
  const [imageFile, setImageFile] = useState(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  const theaters = [
    { id: 'kota1', name: 'KOTA 1', fileCode: '1' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3' },
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4' },
  ];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- PUSHER LOGIC ---
  useEffect(() => {
    const pusher = new Pusher("0396bd8cd1f0bbf91a96", { cluster: "ap1" });
    const channel = pusher.subscribe('cinema-channel');
    
    channel.bind('trigger-audio', (data) => {
      const theaterId = data.studio.toLowerCase().replace(/[^a-z0-9]/g, ''); 
      const action = data.type === 'pintu-buka' ? 'open' : 'start';
      addToAudioQueue(theaterId, action, `AUTO: ${data.studio}`);
    });

    return () => pusher.unsubscribe('cinema-channel');
  }, []);

  const addToAudioQueue = (roomId, action, label) => {
    const newEntry = { id: Date.now() + Math.random(), roomId, action, label };
    setAudioQueue(prev => [...prev, newEntry]);
  };

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying && !isProcessingQueue.current) {
      const nextAudio = audioQueue[0];
      isProcessingQueue.current = true;
      toggleAudio(nextAudio.roomId, nextAudio.action, true);
    }
  }, [audioQueue, isPlaying]);

  // --- SCHEDULER CHECKER ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (scheduleQueue.length === 0) return;
      const now = new Date();
      const currentHHMM = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
      const jobsToRun = scheduleQueue.filter(job => job.time === currentHHMM);
      if (jobsToRun.length > 0) {
        jobsToRun.forEach(job => {
            const [roomId, action] = job.target.split('-');
            addToAudioQueue(roomId, action, job.label);
        });
        setScheduleQueue(prev => prev.filter(item => item.time !== currentHHMM));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduleQueue]);

  const toggleAudio = (roomId, action, fromQueue = false) => {
    const targetId = `${roomId}-${action}`;
    const selectedTheater = theaters.find(t => t.id === roomId);
    if (!selectedTheater) return;

    if (activeId === targetId && isPlaying && !fromQueue) {
        audioRef.current.pause(); setIsPlaying(false); isProcessingQueue.current = false;
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      let fileName = action === 'open' ? `/pintu${selectedTheater.fileCode}.wav` : `/pertunjukan${selectedTheater.fileCode}.wav`;
      const newAudio = new Audio(fileName);
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

  const handleAddManual = () => {
    if (!inputTime || !inputTarget || !inputLabel) return alert("Lengkapi data!");
    const [rId, act] = inputTarget.split('-');
    const rName = theaters.find(t => t.id === rId)?.name || rId;
    const newJob = {
      id: Date.now(), time: inputTime, label: inputLabel, target: inputTarget,
      displayAudio: `${rName} - ${act === 'open' ? 'Pintu Buka' : 'Start'}`
    };
    setScheduleQueue(prev => [...prev, newJob].sort((a, b) => a.time.localeCompare(b.time)));
    setInputLabel(""); setInputTarget("");
  };

  const processScheduleData = (jsonData) => {
    try {
        const newJobs = jsonData.map(item => {
            const [rId, act] = item.target.split('-');
            const rName = theaters.find(t => t.id === rId)?.name || rId;
            return {
                id: Date.now() + Math.random(), time: item.time, label: item.label, target: item.target,
                displayAudio: `${rName} - ${act === 'open' ? 'Pintu Buka' : 'Start'}`
            };
        });
        setScheduleQueue(prev => [...prev, ...newJobs].sort((a, b) => a.time.localeCompare(b.time)));
        return true;
    } catch (e) { return false; }
  };

  const AudioControl = ({ label, roomId, action }) => { 
    const myId = `${roomId}-${action}`;
    const isActive = activeId === myId;
    return (
      <div className="flex w-full h-16 rounded-lg overflow-hidden shadow-md border border-slate-600 mt-2">
        <button onClick={() => toggleAudio(roomId, action)} className={`flex-1 flex items-center px-4 gap-3 ${isActive ? 'bg-emerald-600' : 'bg-slate-700'} text-white`}>
          {isActive && isPlaying ? <Pause size={18}/> : <Play size={18}/>} <span className="font-bold text-sm">{label}</span>
        </button>
        <button onClick={stopAudio} className="w-14 bg-slate-800 flex items-center justify-center border-l border-black/20 text-slate-500"><Square size={18}/></button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative">
      {isLocked && <div className="fixed inset-0 z-40 cursor-not-allowed"></div>}

      <div className="relative z-50 max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-4">
            <img src="/logo1.png" className="h-12 w-auto" alt="Logo"/>
            <div>
                <h1 className="text-2xl font-bold text-yellow-500 tracking-tighter">CINEMA CONTROL</h1>
                <p className="text-slate-400 text-xs">Hybrid Automation v10.0</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsLocked(!isLocked)} className="px-4 py-2 rounded bg-slate-800 border border-slate-600 text-xs font-bold">
                {isLocked ? <Unlock size={16}/> : <Lock size={16}/>} {isLocked ? 'BUKA KUNCI' : 'KUNCI UI'}
            </button>
            <button onClick={stopAudio} className="px-4 py-2 rounded bg-red-900/50 border border-red-800 text-xs font-bold">STOP ALL</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mb-8 flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border-2 border-cyan-500/30 text-center">
                <h2 className="text-5xl font-mono font-black text-cyan-400 tracking-wider">
                    {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
                </h2>
                <p className="text-cyan-200/50 text-xs mt-1 uppercase tracking-widest">{currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAiModal(true)} disabled={isLocked} className="bg-indigo-900/40 py-3 rounded-lg text-xs font-bold border border-indigo-500/50 flex flex-col items-center gap-1"><Sparkles size={18}/> SCAN AI</button>
                <button onClick={() => setShowJsonModal(true)} disabled={isLocked} className="bg-emerald-900/40 py-3 rounded-lg text-xs font-bold border border-emerald-500/50 flex flex-col items-center gap-1"><FileJson size={18}/> PASTE JSON</button>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="text-slate-400 font-bold mb-3 text-sm uppercase flex items-center gap-2"><PlusCircle size={16}/> Input Manual</h3>
                <div className="space-y-3">
                    <input type="time" value={inputTime} onChange={(e) => setInputTime(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white font-mono"/>
                    <input type="text" value={inputLabel} onChange={(e) => setInputLabel(e.target.value)} placeholder="Label / Judul" className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white"/>
                    <select value={inputTarget} onChange={(e) => setInputTarget(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                        <option value="">-- Target --</option>
                        {theaters.map(t => (
                            <optgroup key={t.id} label={t.name}>
                                <option value={`${t.id}-open`}>{t.name} - Buka Pintu</option>
                                <option value={`${t.id}-start`}>{t.name} - Show Mulai</option>
                            </optgroup>
                        ))}
                    </select>
                    <button onClick={handleAddManual} className="w-full bg-slate-700 font-bold py-2 rounded">TAMBAH</button>
                </div>
            </div>
        </div>

        <div className="lg:w-2/3 bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col min-h-[400px]">
            <h3 className="text-emerald-400 font-bold mb-4 flex gap-2 border-b border-slate-700 pb-2"><List/> PLAYLIST JADWAL</h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {scheduleQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50"><CalendarClock size={60}/> <p className="mt-2 text-sm">Playlist Kosong</p></div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-slate-700">
                            {scheduleQueue.map(job => (
                                <tr key={job.id}>
                                    <td className="p-3 font-mono text-emerald-400 font-bold text-lg">{job.time}</td>
                                    <td className="p-3">
                                        <div className="font-bold text-white">{job.label}</div>
                                        <div className="text-xs text-slate-400">{job.displayAudio}</div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => setScheduleQueue(q => q.filter(i => i.id !== job.id))} className="text-slate-600 hover:text-red-500"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-20">
        {theaters.map(t => (
          <div key={t.id} className="p-4 rounded-xl border border-slate-700 bg-slate-800/80">
            <h2 className="font-black uppercase mb-2 text-slate-400">{t.name}</h2>
            <AudioControl roomId={t.id} action="open" label="PINTU BUKA" />
            <AudioControl roomId={t.id} action="start" label="SHOW MULAI" />
          </div>
        ))}
      </div>

      {audioQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 z-50">
          <Loader2 className="animate-spin" size={20}/>
          <span className="font-bold text-sm uppercase tracking-widest">{audioQueue[0].label}</span>
        </div>
      )}
      
      {/* Modal AI & JSON tetap sama logicnya */}
    </div>
  );
};

export default CinemaApp;