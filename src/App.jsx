import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Clock, CalendarClock, Trash2, List, FileJson, Sparkles, Loader2, ClipboardPaste, Lock, Unlock, ShieldAlert, PlusCircle, Tag } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

const CinemaApp = () => {
  // --- STATE UTAMA ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // --- STATE LOCK SYSTEM ---
  const [isLocked, setIsLocked] = useState(false);

  // --- STATE CLOCK (JAM DIGITAL) ---
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- STATE SCHEDULER ---
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

  // --- LOGIC 1: JAM DIGITAL REALTIME ---
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- LOGIC 2: SCHEDULER CHECKER ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (scheduleQueue.length === 0) return;
      const now = new Date();
      // Format Jam:Menit (HH:MM)
      const currentHHMM = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

      const jobsToRun = scheduleQueue.filter(job => job.time === currentHHMM);
      if (jobsToRun.length > 0) {
        jobsToRun.forEach(job => {
            const [roomId, action] = job.target.split('-');
            toggleAudio(roomId, action);
            console.log(`AUTO-PLAY: ${job.label}`);
        });
        // Hapus job yang sudah jalan
        setScheduleQueue(prev => prev.filter(item => item.time !== currentHHMM));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduleQueue]);

  // --- LOGIC 3: ADD MANUAL ---
  const handleAddManual = () => {
    if (!inputTime || !inputTarget || !inputLabel) return alert("Lengkapi data manual dulu!");
    
    const [rId, act] = inputTarget.split('-');
    const rName = theaters.find(t => t.id === rId)?.name || rId;
    const actName = act === 'open' ? 'Pintu Buka' : 'Start';

    const newJob = {
      id: Date.now(),
      time: inputTime,
      label: inputLabel,
      target: inputTarget,
      displayAudio: `${rName} - ${actName}`
    };

    setScheduleQueue(prev => [...prev, newJob].sort((a, b) => a.time.localeCompare(b.time)));
    setInputLabel("");
    setInputTarget("");
  };

  // --- LOGIC 4: PROSES BULK (AI/JSON) ---
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
        alert(`BERHASIL! ${newJobs.length} jadwal masuk.`);
        return true;
    } catch (e) {
        alert("Format Data Salah!");
        return false;
    }
  };

  const handleManualJsonSubmit = () => {
    try {
        const cleanJson = jsonInput.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (processScheduleData(parsed)) { setShowJsonModal(false); setJsonInput(""); }
    } catch (e) { alert("Gagal parsing JSON."); }
  };

  const handleAiProcess = async () => {
    if (!apiKey) return alert("Butuh API Key!");
    if (!imageFile) return alert("Upload foto dulu!");
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

  // --- AUDIO PLAYER ---
  const toggleAudio = (roomId, action) => {
    const targetId = `${roomId}-${action}`;
    const selectedTheater = theaters.find(t => t.id === roomId);
    if (activeId === targetId && isPlaying) {
        audioRef.current.pause(); setIsPlaying(false);
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      let fileName = action === 'open' ? `/pintu${selectedTheater.fileCode}.wav` : `/pertunjukan${selectedTheater.fileCode}.wav`;
      const newAudio = new Audio(fileName);
      newAudio.onended = () => { setActiveId(null); setIsPlaying(false); };
      audioRef.current = newAudio;
      audioRef.current.play();
      setActiveId(targetId); setIsPlaying(true);
    }
  };
  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setActiveId(null); setIsPlaying(false);
  };

  const AudioControl = ({ label, roomId, action }) => { 
    const myId = `${roomId}-${action}`;
    const isActive = activeId === myId;
    let color = isActive ? (isPlaying ? "bg-emerald-600 animate-pulse" : "bg-amber-600") : "bg-slate-700";
    return (
      <div className="flex w-full h-16 rounded-lg overflow-hidden shadow-md border border-slate-600 mt-2">
        <button onClick={() => toggleAudio(roomId, action)} className={`flex-1 flex items-center px-4 gap-3 ${color} text-white`}>
          {isActive && isPlaying ? <Pause /> : <Play />} <span className="font-bold text-sm">{label}</span>
        </button>
        <button onClick={stopAudio} className="w-14 bg-slate-800 flex items-center justify-center border-l border-black/20 text-slate-500 hover:text-red-500"><Square size={18}/></button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative">
      
      {/* SHIELD LOCK */}
      {isLocked && <div className="fixed inset-0 z-40 cursor-not-allowed bg-transparent"></div>}

      {/* HEADER */}
      <div className="relative z-50 max-w-6xl mx-auto mb-6 flex justify-between items-end border-b border-slate-700 pb-4">
        <div className="flex items-center gap-4">
            <div className="relative">
                <img src="/logo1.png" className={`h-12 w-auto transition-all ${isLocked ? 'opacity-50 grayscale' : ''}`} alt="Logo"/>
                {isLocked && <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg animate-bounce"><Lock size={16} /></div>}
            </div>
            <div>
                <h1 className="text-2xl font-bold text-yellow-500">CINEMA CONTROL</h1>
                <p className="text-slate-400 text-xs">
                    {isLocked ? <span className="text-red-400 font-bold flex items-center gap-1"><ShieldAlert size={12}/> SYSTEM LOCKED</span> : "All-in-One Automation v9.0"}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={() => setIsLocked(!isLocked)} className={`flex items-center gap-2 px-4 py-2 rounded border font-bold transition-all shadow-lg ${isLocked ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                {isLocked ? <><Unlock size={18}/> BUKA KUNCI</> : <><Lock size={18}/> KUNCI UI</>}
            </button>
            <button onClick={stopAudio} className={`px-4 py-2 rounded flex items-center gap-2 border transition-colors ${isLocked ? 'bg-slate-800 border-slate-700 text-slate-600 opacity-50' : 'bg-red-900/50 hover:bg-red-800 text-red-200 border-red-800'}`}>
                <Square size={18} fill="currentColor"/> STOP ALL
            </button>
        </div>
      </div>

      {/* --- CONTENT UTAMA --- */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col lg:flex-row gap-6">
        
        {/* KOLOM KIRI: WIDGET JAM + INPUT AREA */}
        <div className="lg:w-1/3 space-y-4">
            
            {/* === WIDGET JAM DIGITAL BESAR (BARU) === */}
            <div className="bg-slate-950 p-4 rounded-xl border-2 border-cyan-500/30 text-center shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                
                {/* JAM BESAR (HH:MM:SS) */}
                <h2 className="text-5xl font-mono font-black text-cyan-400 tracking-wider drop-shadow-md">
                    {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
                </h2>
                
                {/* TANGGAL */}
                <p className="text-cyan-200/50 text-xs font-bold uppercase tracking-[0.2em] mt-1 border-t border-cyan-900/50 pt-1 mx-8">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            {/* BUTTON ACTION (SCAN & JSON) */}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAiModal(true)} disabled={isLocked} className="bg-indigo-900/40 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-100 py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-50">
                    <Sparkles size={18}/> SCAN AI
                </button>
                <button onClick={() => setShowJsonModal(true)} disabled={isLocked} className="bg-emerald-900/40 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-100 py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-50">
                    <ClipboardPaste size={18}/> PASTE JSON
                </button>
            </div>

            {/* FORM MANUAL */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 relative">
                <h3 className="text-slate-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider border-b border-slate-700 pb-2">
                    <PlusCircle size={16}/> Input Manual
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase block mb-1">Jam Tayang</label>
                        <input type="time" value={inputTime} onChange={(e) => setInputTime(e.target.value)} disabled={isLocked}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-lg font-mono focus:border-yellow-500 outline-none text-white disabled:opacity-50"/>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase block mb-1">Label / Judul</label>
                        <div className="relative">
                            <Tag className="absolute left-3 top-2.5 text-slate-500" size={14}/>
                            <input type="text" value={inputLabel} onChange={(e) => setInputLabel(e.target.value)} disabled={isLocked} placeholder="Contoh: Batman Show 1"
                                className="w-full bg-slate-900 border border-slate-600 rounded pl-9 pr-3 py-2 text-sm focus:border-yellow-500 outline-none text-white disabled:opacity-50"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 uppercase block mb-1">Target Audio</label>
                        <select value={inputTarget} onChange={(e) => setInputTarget(e.target.value)} disabled={isLocked}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:border-yellow-500 outline-none text-white disabled:opacity-50">
                            <option value="">-- Pilih --</option>
                            {theaters.map(t => (
                                <optgroup key={t.id} label={t.name}>
                                    <option value={`${t.id}-open`}>{t.name} - Pintu Buka</option>
                                    <option value={`${t.id}-start`}>{t.name} - Show Mulai</option>
                                </optgroup>
                            ))}
                        </select>
                    </div>
                    <button onClick={handleAddManual} disabled={isLocked} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded border border-slate-600 flex justify-center gap-2 text-sm disabled:opacity-50 transition-colors">
                        <PlusCircle size={16}/> TAMBAH
                    </button>
                </div>
            </div>

            {/* STATS */}
            <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 text-center flex justify-between items-center px-6">
                <span className="text-slate-400 text-xs">TOTAL ANTRIAN</span>
                <span className="text-2xl font-bold text-emerald-400">{scheduleQueue.length}</span>
            </div>
        </div>

        {/* KOLOM KANAN: LIST QUEUE */}
        <div className="lg:w-2/3 bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col min-h-[400px]">
            <h3 className="text-emerald-400 font-bold mb-4 flex gap-2 border-b border-slate-700 pb-2"><List/> PLAYLIST JADWAL</h3>
            <div className="flex-1 overflow-y-auto max-h-[580px]">
                {scheduleQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <CalendarClock size={60}/> <p className="mt-2 text-sm">Playlist Kosong</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="text-slate-500 uppercase text-xs sticky top-0 bg-slate-800 z-10">
                            <tr><th className="p-2">Jam</th><th className="p-2">Event</th><th className="p-2 text-right">Hapus</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {scheduleQueue.map(job => (
                                <tr key={job.id} className="hover:bg-slate-700/50 group">
                                    <td className="p-2 font-mono text-emerald-400 font-bold text-lg align-top">{job.time}</td>
                                    <td className="p-2 align-top">
                                        <div className="font-bold text-white">{job.label}</div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Volume2 size={12}/> {job.displayAudio}</div>
                                    </td>
                                    <td className="p-2 text-right align-middle">
                                        <button disabled={isLocked} onClick={() => setScheduleQueue(q => q.filter(i => i.id !== job.id))} className="text-slate-600 hover:text-red-500 p-2 disabled:opacity-30"><Trash2 size={16}/></button>
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
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {theaters.map(t => (
          <div key={t.id} className={`p-4 rounded-xl border ${t.id === 'suite' ? 'border-yellow-600 bg-slate-800' : 'border-slate-700 bg-slate-800'}`}>
            <h2 className={`font-black uppercase mb-2 ${t.id === 'suite' ? 'text-yellow-500' : 'text-slate-300'}`}>{t.name}</h2>
            <AudioControl roomId={t.id} action="open" label="PINTU BUKA" />
            <AudioControl roomId={t.id} action="start" label="SHOW MULAI" />
          </div>
        ))}
      </div>

      {/* MODAL AI */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
                <button onClick={() => setShowAiModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><Square size={20}/></button>
                <h2 className="text-xl font-bold text-indigo-400 mb-4 flex gap-2"><Sparkles/> AI SCANNER</h2>
                <div className="mb-4">
                    <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key Gemini..." className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm outline-none focus:border-indigo-500"/>
                </div>
                <div className="mb-6 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-indigo-500 cursor-pointer relative">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer"/>
                    {imageFile ? <div className="text-emerald-400 font-bold">{imageFile.name}</div> : <div className="text-slate-500 text-sm">Upload Foto Jadwal</div>}
                </div>
                <button onClick={handleAiProcess} disabled={isAiProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {isAiProcessing ? <Loader2 className="animate-spin"/> : "PROSES SEKARANG"}
                </button>
            </div>
        </div>
      )}

      {/* MODAL JSON */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500 rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
                <button onClick={() => setShowJsonModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><Square size={20}/></button>
                <h2 className="text-xl font-bold text-emerald-400 mb-2 flex gap-2"><FileJson/> IMPORT JSON</h2>
                <p className="text-slate-400 text-xs mb-4">Paste kode JSON dari Chat di sini.</p>
                <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder='[ {"time": "12:00", ...} ]' className="w-full h-64 bg-slate-800 border border-slate-700 text-emerald-300 font-mono text-xs p-4 rounded-lg outline-none focus:border-emerald-500 mb-4"></textarea>
                <div className="flex gap-3">
                    <button onClick={() => setJsonInput("")} className="flex-1 py-3 border border-slate-600 text-slate-400 rounded-lg hover:bg-slate-800">RESET</button>
                    <button onClick={handleManualJsonSubmit} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg">IMPORT JADWAL</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default CinemaApp;