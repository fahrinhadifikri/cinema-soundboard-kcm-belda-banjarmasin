import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Square, Volume2, Clock, CalendarClock, Trash2, List, 
  FileJson, Sparkles, Loader2, ClipboardPaste, Lock, Unlock, 
  ShieldAlert, PlusCircle, Radio, Signal, SignalLow 
} from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Pusher from 'pusher-js';

const CinemaApp = () => {
  // --- STATE UTAMA ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // --- STATE KONEKSI & ANTREAN ---
  const [connectionStatus, setConnectionStatus] = useState('initialized');
  const [audioQueue, setAudioQueue] = useState([]);
  const isProcessingQueue = useRef(false);

  // --- STATE UI & SCHEDULER ---
  const [isLocked, setIsLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [scheduleQueue, setScheduleQueue] = useState([]);
  
  // State Input Manual
  const [inputTime, setInputTime] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [inputTarget, setInputTarget] = useState("");

  // State AI & JSON
  const [showAiModal, setShowAiModal] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem("GEMINI_KEY") || "");
  const [imageFile, setImageFile] = useState(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  // --- DATA RUANGAN ---
  const theaters = [
    { id: 'kota1', name: 'KOTA 1', fileCode: '1' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3' },
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4' },
  ];

  // --- LOGIC 1: JAM DIGITAL ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- LOGIC 2: PUSHER REAL-TIME & CONNECTION STATUS ---
  useEffect(() => {
    const pusher = new Pusher("0396bd8cd1f0bbf91a96", {
      cluster: "ap1",
      forceTLS: true
    });

    // Pantau Status Koneksi
    pusher.connection.bind('state_change', (states) => {
      setConnectionStatus(states.current);
    });

    const channel = pusher.subscribe('cinema-channel');
    
    channel.bind('trigger-audio', (data) => {
      console.log("Sinyal Tampermonkey diterima:", data);
      const theaterId = data.studio.toLowerCase().replace(/[^a-z0-9]/g, ''); 
      const action = data.type === 'pintu-buka' ? 'open' : 'start';
      
      addToAudioQueue(theaterId, action, `AUTO: ${data.studio}`);
    });

    return () => {
      pusher.unsubscribe('cinema-channel');
      pusher.disconnect();
    };
  }, []);

  // --- LOGIC 3: AUDIO QUEUE SYSTEM ---
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

  // --- LOGIC 4: SCHEDULER CHECKER ---
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

  // --- AUDIO PLAYER CORE ---
  const toggleAudio = (roomId, action, fromQueue = false) => {
    const targetId = `${roomId}-${action}`;
    const selectedTheater = theaters.find(t => t.id === roomId);
    
    if (!selectedTheater) return;

    if (activeId === targetId && isPlaying && !fromQueue) {
        audioRef.current.pause(); 
        setIsPlaying(false);
        isProcessingQueue.current = false;
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      
      let fileName = action === 'open' ? `/pintu${selectedTheater.fileCode}.wav` : `/pertunjukan${selectedTheater.fileCode}.wav`;
      
      const newAudio = new Audio(fileName);
      newAudio.onended = () => { 
        setActiveId(null); 
        setIsPlaying(false);
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      };

      audioRef.current = newAudio;
      audioRef.current.play().catch(err => {
        console.error("Autoplay diblokir browser. Klik layar dulu.");
        setIsPlaying(false);
        isProcessingQueue.current = false;
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      });
      
      setActiveId(targetId); setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setActiveId(null); 
    setIsPlaying(false);
    setAudioQueue([]); 
    isProcessingQueue.current = false;
  };

  // --- HANDLERS (Manual, AI, JSON) ---
  const handleAddManual = () => {
    if (!inputTime || !inputTarget || !inputLabel) return alert("Lengkapi data!");
    const [rId, act] = inputTarget.split('-');
    const rName = theaters.find(t => t.id === rId)?.name || rId;
    const newJob = {
      id: Date.now(),
      time: inputTime,
      label: inputLabel,
      target: inputTarget,
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
                id: Date.now() + Math.random(),
                time: item.time,
                label: item.label,
                target: item.target,
                displayAudio: `${rName} - ${act === 'open' ? 'Pintu Buka' : 'Start'}`
            };
        });
        setScheduleQueue(prev => [...prev, ...newJobs].sort((a, b) => a.time.localeCompare(b.time)));
        return true;
    } catch (e) { return false; }
  };

  const handleManualJsonSubmit = () => {
    try {
        const cleanJson = jsonInput.replace(/```json/g, '').replace(/```/g, '').trim();
        if (processScheduleData(JSON.parse(cleanJson))) { setShowJsonModal(false); setJsonInput(""); }
    } catch (e) { alert("Gagal parsing JSON."); }
  };

  const handleAiProcess = async () => {
    if (!apiKey || !imageFile) return alert("Lengkapi API Key & Foto!");
    setIsAiProcessing(true);
    localStorage.setItem("GEMINI_KEY", apiKey);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        reader.onloadend = async () => {
            const base64Data = reader.result.split(',')[1];
            const prompt = `Baca jadwal film. Output JSON Array: [{"time": "HH:MM", "label": "Judul", "target": "kotaX-action"}]. 
            RULES: 1. Buat DUA jadwal: 15 min sebelum (-open) dan pas jam tayang (-start). 
            2. Target: kota1-open, kota1-start, dst. Suite pakai 'suite'. Output JSON MURNI.`;
            const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: imageFile.type } }]);
            processScheduleData(JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()));
            setShowAiModal(false); setImageFile(null); setIsAiProcessing(false);
        };
    } catch (error) { alert("Gagal AI: " + error.message); setIsAiProcessing(false); }
  };

  // --- SUB-KOMPONEN UI ---
  const AudioControl = ({ label, roomId, action }) => { 
    const myId = `${roomId}-${action}`;
    const isActive = activeId === myId;
    let color = isActive ? (isPlaying ? "bg-emerald-600 animate-pulse" : "bg-amber-600") : "bg-slate-700 hover:bg-slate-600";
    return (
      <div className="flex w-full h-16 rounded-lg overflow-hidden shadow-md border border-slate-600 mt-2">
        <button onClick={() => toggleAudio(roomId, action)} className={`flex-1 flex items-center px-4 gap-3 ${color} text-white transition-all`}>
          {isActive && isPlaying ? <Pause size={20}/> : <Play size={20}/>} 
          <span className="font-bold text-xs uppercase tracking-tight text-left leading-tight">{label}</span>
        </button>
        <button onClick={stopAudio} className="w-12 bg-slate-800 flex items-center justify-center border-l border-black/20 text-slate-500 hover:text-red-500">
          <Square size={16}/>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative overflow-x-hidden">
      
      {isLocked && <div className="fixed inset-0 z-40 cursor-not-allowed bg-transparent"></div>}

      {/* HEADER DENGAN STATUS KONEKSI */}
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
                  
                  {/* NOTIFIKASI KONEKSI PUSHER */}
                  <div className="flex items-center gap-1.5 ml-2 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${
                      connectionStatus === 'connected' ? 'bg-emerald-500 shadow-emerald-500 animate-pulse' : 
                      connectionStatus === 'connecting' ? 'bg-amber-500 shadow-amber-500 animate-bounce' : 'bg-red-500 shadow-red-500'
                    }`}></div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      connectionStatus === 'connected' ? 'text-emerald-400' : 
                      connectionStatus === 'connecting' ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {connectionStatus === 'connected' ? 'Online' : connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
                    </span>
                  </div>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button onClick={() => setIsLocked(!isLocked)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-black text-xs transition-all shadow-lg ${isLocked ? 'bg-red-600 border-red-500 text-white shadow-red-500/20' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isLocked ? <><Unlock size={14}/> OPEN UI</> : <><Lock size={14}/> LOCK UI</>}
            </button>
            <button onClick={stopAudio} className="px-4 py-2 rounded-lg flex items-center gap-2 border bg-red-900/40 hover:bg-red-800 text-red-200 border-red-800/50 text-xs font-black transition-all">
                <Square size={14} fill="currentColor"/> STOP ALL
            </button>
        </div>
      </div>

      {/* --- CONTENT UTAMA --- */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col lg:flex-row gap-6">
        
        {/* KOLOM KIRI: JAM + INPUT */}
        <div className="lg:w-1/3 space-y-4">
            <div className="bg-slate-950 p-6 rounded-2xl border-2 border-cyan-500/30 text-center shadow-[0_0_40px_rgba(6,182,212,0.1)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                <h2 className="text-6xl font-mono font-black text-cyan-400 tracking-tighter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                    {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
                </h2>
                <p className="text-cyan-200/40 text-[10px] font-black uppercase tracking-[0.3em] mt-2 pt-2 border-t border-cyan-900/30">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowAiModal(true)} disabled={isLocked} className="bg-indigo-900/30 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-100 py-3 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-all disabled:opacity-30">
                    <Sparkles size={20}/> SCAN JADWAL
                </button>
                <button onClick={() => setShowJsonModal(true)} disabled={isLocked} className="bg-emerald-900/30 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-100 py-3 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-black transition-all disabled:opacity-30">
                    <ClipboardPaste size={20}/> PASTE JSON
                </button>
            </div>

            <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                <h3 className="text-slate-500 font-black mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                    <PlusCircle size={14}/> Input Manual
                </h3>
                <div className="space-y-3">
                    <input type="time" value={inputTime} onChange={(e) => setInputTime(e.target.value)} disabled={isLocked} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-2xl font-mono text-cyan-400 outline-none focus:border-cyan-500 transition-all"/>
                    <input type="text" value={inputLabel} onChange={(e) => setInputLabel(e.target.value)} disabled={isLocked} placeholder="Judul Film" className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-indigo-500"/>
                    <select value={inputTarget} onChange={(e) => setInputTarget(e.target.value)} disabled={isLocked} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white outline-none appearance-none">
                        <option value="">-- PILIH THEATER --</option>
                        {theaters.map(t => (
                            <optgroup key={t.id} label={t.name} className="bg-slate-900">
                                <option value={`${t.id}-open`}>{t.name} - Buka Pintu</option>
                                <option value={`${t.id}-start`}>{t.name} - Show Mulai</option>
                            </optgroup>
                        ))}
                    </select>
                    <button onClick={handleAddManual} disabled={isLocked} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl shadow-lg shadow-cyan-900/20 transition-all text-xs uppercase tracking-widest">SUBMIT</button>
                </div>
            </div>
        </div>

        {/* KOLOM KANAN: JADWAL */}
        <div className="lg:w-2/3 bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 flex flex-col min-h-[500px] backdrop-blur-sm">
            <h3 className="text-emerald-400 font-black mb-4 flex gap-2 text-[10px] uppercase tracking-[0.2em] border-b border-slate-700/50 pb-3"><List size={14}/> LIVE PLAYLIST</h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {scheduleQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-30">
                        <CalendarClock size={80}/> <p className="mt-4 font-black uppercase text-xs tracking-widest">No Schedule</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <tbody className="divide-y divide-slate-700/50">
                            {scheduleQueue.map(job => (
                                <tr key={job.id} className="group hover:bg-slate-700/20 transition-all">
                                    <td className="py-4 font-mono text-emerald-400 font-black text-xl w-24">{job.time}</td>
                                    <td className="py-4 px-2">
                                        <div className="font-black text-xs text-white uppercase tracking-tight">{job.label}</div>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{job.displayAudio}</div>
                                    </td>
                                    <td className="py-4 text-right">
                                        <button disabled={isLocked} onClick={() => setScheduleQueue(q => q.filter(i => i.id !== job.id))} className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-20"><Trash2 size={18}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      </div>

      {/* GRID SOUNDBOARD MANUAL */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-24">
        {theaters.map(t => (
          <div key={t.id} className={`p-5 rounded-2xl border-2 shadow-xl backdrop-blur-md transition-all ${t.id === 'suite' ? 'border-yellow-600/30 bg-yellow-900/5' : 'border-slate-700/50 bg-slate-800/50'}`}>
            <h2 className={`font-black uppercase text-[10px] tracking-[0.3em] mb-4 ${t.id === 'suite' ? 'text-yellow-500' : 'text-slate-500'}`}>{t.name}</h2>
            <AudioControl roomId={t.id} action="open" label="Buka Pintu" />
            <AudioControl roomId={t.id} action="start" label="Mulai Film" />
          </div>
        ))}
      </div>

      {/* FOOTER ANTREAN FLOATING */}
      {audioQueue.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4">
          <div className="bg-emerald-600 text-white p-5 rounded-3xl shadow-[0_20px_50px_rgba(16,185,129,0.3)] flex items-center justify-between border-2 border-white/20 backdrop-blur-lg">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl animate-spin"><Loader2 size={24}/></div>
              <div className="overflow-hidden">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70 leading-none mb-1">Playing Now</p>
                <p className="font-black text-sm truncate uppercase tracking-tighter">{audioQueue[0].label}</p>
              </div>
            </div>
            <div className="bg-black/30 px-3 py-1.5 rounded-xl text-[10px] font-black font-mono">
              NEXT: {audioQueue.length - 1}
            </div>
          </div>
        </div>
      )}

      {/* MODALS (AI & JSON) */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
                <button onClick={() => setShowAiModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><Square size={20}/></button>
                <h2 className="text-xl font-black text-indigo-400 mb-6 flex gap-3 uppercase tracking-tighter"><Sparkles/> AI Scanner</h2>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Gemini API Key..." className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 mb-4 outline-none focus:border-indigo-500 text-white text-xs"/>
                <div className="mb-6 border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center relative hover:border-indigo-500 transition-all group">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer"/>
                    {imageFile ? <div className="text-emerald-400 font-black text-xs uppercase">{imageFile.name}</div> : <div className="text-slate-500 text-xs font-bold uppercase tracking-widest group-hover:text-indigo-400 transition-all">Upload Jadwal</div>}
                </div>
                <button onClick={handleAiProcess} disabled={isAiProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl flex justify-center gap-3 transition-all shadow-lg shadow-indigo-900/40 text-xs uppercase tracking-[0.2em]">
                    {isAiProcessing ? <Loader2 className="animate-spin"/> : "Start Scanning"}
                </button>
            </div>
        </div>
      )}

      {showJsonModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl w-full max-w-lg p-8 shadow-2xl relative">
                <button onClick={() => setShowJsonModal(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><Square size={20}/></button>
                <h2 className="text-xl font-black text-emerald-400 mb-4 flex gap-3 uppercase tracking-tighter"><FileJson/> Import JSON</h2>
                <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder='Paste JSON Array di sini...' className="w-full h-64 bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[10px] p-5 rounded-2xl outline-none mb-6 focus:border-emerald-500 transition-all"></textarea>
                <div className="flex gap-4">
                    <button onClick={() => setJsonInput("")} className="flex-1 py-4 border border-slate-700 text-slate-500 font-black rounded-xl text-xs uppercase tracking-widest hover:bg-slate-800">Clear</button>
                    <button onClick={handleManualJsonSubmit} className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all">Import</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default CinemaApp;