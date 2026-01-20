import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Clock, CalendarClock, Trash2, List, FileJson, Sparkles, Loader2, ClipboardPaste, Lock, Unlock, ShieldAlert, PlusCircle, Tag, Radio } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Pusher from 'pusher-js'; // Pastikan sudah install: npm install pusher-js

const CinemaApp = () => {
  // --- STATE UTAMA ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // --- STATE ANTREAN SUARA (NEW) ---
  const [audioQueue, setAudioQueue] = useState([]);
  const isProcessingQueue = useRef(false);

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

  // --- LOGIC 2: PUSHER REAL-TIME (NEW) ---
  useEffect(() => {
    // Gunakan Key Pusher yang kamu berikan
    const pusher = new Pusher("0396bd8cd1f0bbf91a96", {
    cluster: "ap1"
    });

    const channel = pusher.subscribe('cinema-channel');
    
    channel.bind('trigger-audio', (data) => {
      console.log("Sinyal Tampermonkey diterima:", data);
      // Data format: { studio: "KOTA-1", type: "pintu-buka" }
      // Kita konversi nama studio dari proyektor ke ID theater kita
      const theaterId = data.studio.toLowerCase().replace(/[^a-z0-9]/g, ''); 
      const action = data.type === 'pintu-buka' ? 'open' : 'start';
      
      // Masukkan ke antrean audio
      addToAudioQueue(theaterId, action, `AUTO: ${data.studio}`);
    });

    return () => {
      pusher.unsubscribe('cinema-channel');
    };
  }, []);

  // --- LOGIC 3: AUDIO QUEUE SYSTEM (NEW) ---
  const addToAudioQueue = (roomId, action, label) => {
    const newEntry = { id: Date.now() + Math.random(), roomId, action, label };
    setAudioQueue(prev => [...prev, newEntry]);
  };

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying && !isProcessingQueue.current) {
      const nextAudio = audioQueue[0];
      executeAudioFromQueue(nextAudio);
    }
  }, [audioQueue, isPlaying]);

  const executeAudioFromQueue = (job) => {
    isProcessingQueue.current = true;
    toggleAudio(job.roomId, job.action, true); // True menandakan ini dari queue
  };

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
            // Masukkan ke Audio Queue agar tidak bentrok dengan suara lain
            addToAudioQueue(roomId, action, job.label);
        });
        setScheduleQueue(prev => prev.filter(item => item.time !== currentHHMM));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduleQueue]);

  // --- AUDIO PLAYER ---
  const toggleAudio = (roomId, action, fromQueue = false) => {
    const targetId = `${roomId}-${action}`;
    const selectedTheater = theaters.find(t => t.id === roomId);
    
    if (!selectedTheater) return;

    if (activeId === targetId && isPlaying && !fromQueue) {
        audioRef.current.pause(); setIsPlaying(false);
        isProcessingQueue.current = false;
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      
      let fileName = action === 'open' ? `/pintu${selectedTheater.fileCode}.wav` : `/pertunjukan${selectedTheater.fileCode}.wav`;
      
      const newAudio = new Audio(fileName);
      newAudio.onended = () => { 
        setActiveId(null); 
        setIsPlaying(false);
        isProcessingQueue.current = false;
        // Hapus item pertama dari antrean setelah selesai
        if (fromQueue) setAudioQueue(prev => prev.slice(1));
      };

      audioRef.current = newAudio;
      audioRef.current.play().catch(err => {
        console.error("Autoplay diblokir browser. Klik layar dulu.");
        setIsPlaying(false);
        isProcessingQueue.current = false;
      });
      
      setActiveId(targetId); setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setActiveId(null); 
    setIsPlaying(false);
    setAudioQueue([]); // Bersihkan antrean jika stop dipaksa
    isProcessingQueue.current = false;
  };

  // --- LOGIC ADD MANUAL, AI, JSON TETAP SAMA ---
  const handleAddManual = () => {
    if (!inputTime || !inputTarget || !inputLabel) return alert("Lengkapi data manual dulu!");
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
        alert(`BERHASIL! ${newJobs.length} jadwal masuk.`);
        return true;
    } catch (e) { alert("Format Data Salah!"); return false; }
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

  const AudioControl = ({ label, roomId, action }) => { 
    const myId = `${roomId}-${action}`;
    const isActive = activeId === myId;
    let color = isActive ? (isPlaying ? "bg-emerald-600 animate-pulse" : "bg-amber-600") : "bg-slate-700";
    return (
      <div className="flex w-full h-16 rounded-lg overflow-hidden shadow-md border border-slate-600 mt-2">
        <button onClick={() => toggleAudio(roomId, action)} className={`flex-1 flex items-center px-4 gap-3 ${color} text-white transition-all`}>
          {isActive && isPlaying ? <Pause /> : <Play />} <span className="font-bold text-sm">{label}</span>
        </button>
        <button onClick={stopAudio} className="w-14 bg-slate-800 flex items-center justify-center border-l border-black/20 text-slate-500 hover:text-red-500"><Square size={18}/></button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 font-sans relative overflow-x-hidden">
      
      {isLocked && <div className="fixed inset-0 z-40 cursor-not-allowed bg-transparent"></div>}

      {/* HEADER */}
      <div className="relative z-50 max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-700 pb-4">
        <div className="flex items-center gap-4">
            <div className="relative">
                <img src="/logo1.png" className={`h-12 w-auto transition-all ${isLocked ? 'opacity-50 grayscale' : ''}`} alt="Logo"/>
                {isLocked && <div className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full shadow-lg animate-bounce"><Lock size={16} /></div>}
            </div>
            <div>
                <h1 className="text-2xl font-bold text-yellow-500">CINEMA CONTROL</h1>
                <p className="text-slate-400 text-xs">
                    {isLocked ? <span className="text-red-400 font-bold flex items-center gap-1"><ShieldAlert size={12}/> SYSTEM LOCKED</span> : "Hybrid Automation v10.0"}
                </p>
            </div>
        </div>
        
        {/* ANTREAN LIVE INDICATOR */}
        {audioQueue.length > 0 && (
          <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-400 px-4 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-2">
            <Radio size={14}/> {audioQueue.length} ANTRIAN SUARA
          </div>
        )}

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
            <div className="bg-slate-950 p-4 rounded-xl border-2 border-cyan-500/30 text-center shadow-[0_0_20px_rgba(6,182,212,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                <h2 className="text-5xl font-mono font-black text-cyan-400 tracking-wider drop-shadow-md">
                    {currentTime.toLocaleTimeString('id-ID', { hour12: false })}
                </h2>
                <p className="text-cyan-200/50 text-xs font-bold uppercase tracking-[0.2em] mt-1 border-t border-cyan-900/50 pt-1 mx-8">
                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setShowAiModal(true)} disabled={isLocked} className="bg-indigo-900/40 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-100 py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-50">
                    <Sparkles size={18}/> SCAN AI
                </button>
                <button onClick={() => setShowJsonModal(true)} disabled={isLocked} className="bg-emerald-900/40 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-100 py-3 rounded-lg flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all disabled:opacity-50">
                    <ClipboardPaste size={18}/> PASTE JSON
                </button>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h3 className="text-slate-400 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider border-b border-slate-700 pb-2">
                    <PlusCircle size={16}/> Input Manual
                </h3>
                <div className="space-y-3">
                    <input type="time" value={inputTime} onChange={(e) => setInputTime(e.target.value)} disabled={isLocked} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-lg font-mono text-white"/>
                    <input type="text" value={inputLabel} onChange={(e) => setInputLabel(e.target.value)} disabled={isLocked} placeholder="Label / Judul" className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white"/>
                    <select value={inputTarget} onChange={(e) => setInputTarget(e.target.value)} disabled={isLocked} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white">
                        <option value="">-- Target Audio --</option>
                        {theaters.map(t => (
                            <optgroup key={t.id} label={t.name}>
                                <option value={`${t.id}-open`}>{t.name} - Pintu Buka</option>
                                <option value={`${t.id}-start`}>{t.name} - Show Mulai</option>
                            </optgroup>
                        ))}
                    </select>
                    <button onClick={handleAddManual} disabled={isLocked} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded border border-slate-600">TAMBAH</button>
                </div>
            </div>
        </div>

        {/* KOLOM KANAN: LIST QUEUE JADWAL */}
        <div className="lg:w-2/3 bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col min-h-[400px]">
            <h3 className="text-emerald-400 font-bold mb-4 flex gap-2 border-b border-slate-700 pb-2"><List/> PLAYLIST JADWAL</h3>
            <div className="flex-1 overflow-y-auto max-h-[500px]">
                {scheduleQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <CalendarClock size={60}/> <p className="mt-2 text-sm">Playlist Kosong</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <tbody className="divide-y divide-slate-700">
                            {scheduleQueue.map(job => (
                                <tr key={job.id} className="hover:bg-slate-700/50">
                                    <td className="p-3 font-mono text-emerald-400 font-bold text-lg">{job.time}</td>
                                    <td className="p-3">
                                        <div className="font-bold text-white">{job.label}</div>
                                        <div className="text-xs text-slate-400">{job.displayAudio}</div>
                                    </td>
                                    <td className="p-3 text-right">
                                        <button disabled={isLocked} onClick={() => setScheduleQueue(q => q.filter(i => i.id !== job.id))} className="text-slate-600 hover:text-red-500 disabled:opacity-30"><Trash2 size={16}/></button>
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
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-20">
        {theaters.map(t => (
          <div key={t.id} className={`p-4 rounded-xl border shadow-lg ${t.id === 'suite' ? 'border-yellow-600 bg-slate-800/80' : 'border-slate-700 bg-slate-800/80'}`}>
            <h2 className={`font-black uppercase mb-2 ${t.id === 'suite' ? 'text-yellow-500' : 'text-slate-300'}`}>{t.name}</h2>
            <AudioControl roomId={t.id} action="open" label="PINTU BUKA" />
            <AudioControl roomId={t.id} action="start" label="SHOW MULAI" />
          </div>
        ))}
      </div>

      {/* FOOTER ANTREAN SUARA TERKINI (FLOATING) */}
      {audioQueue.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-white/20">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin" size={20}/>
              <div>
                <p className="text-[10px] opacity-80 uppercase font-bold leading-none">Sedang Antre</p>
                <p className="font-bold text-sm truncate">{audioQueue[0].label}</p>
              </div>
            </div>
            <div className="bg-black/20 px-3 py-1 rounded-full text-xs font-mono">
              NEXT: {audioQueue.length - 1}
            </div>
          </div>
        </div>
      )}

      {/* MODAL AI & JSON TETAP SAMA */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500 rounded-xl w-full max-w-md p-6 shadow-2xl relative">
                <button onClick={() => setShowAiModal(false)} className="absolute top-4 right-4 text-slate-500"><Square size={20}/></button>
                <h2 className="text-xl font-bold text-indigo-400 mb-4 flex gap-2"><Sparkles/> AI SCANNER</h2>
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key Gemini..." className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 mb-4 outline-none focus:border-indigo-500 text-white"/>
                <div className="mb-6 border-2 border-dashed border-slate-700 rounded-xl p-8 text-center relative hover:border-indigo-500">
                    <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer"/>
                    {imageFile ? <div className="text-emerald-400 font-bold">{imageFile.name}</div> : <div className="text-slate-500 text-sm">Klik / Drop Foto Jadwal</div>}
                </div>
                <button onClick={handleAiProcess} disabled={isAiProcessing} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex justify-center gap-2">
                    {isAiProcessing ? <Loader2 className="animate-spin"/> : "PROSES JADWAL"}
                </button>
            </div>
        </div>
      )}

      {showJsonModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-emerald-500 rounded-xl w-full max-w-lg p-6 shadow-2xl relative">
                <button onClick={() => setShowJsonModal(false)} className="absolute top-4 right-4 text-slate-500"><Square size={20}/></button>
                <h2 className="text-xl font-bold text-emerald-400 mb-2 flex gap-2"><FileJson/> IMPORT JSON</h2>
                <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder='Paste kode JSON di sini...' className="w-full h-64 bg-slate-800 border border-slate-700 text-emerald-300 font-mono text-xs p-4 rounded-lg outline-none mb-4"></textarea>
                <div className="flex gap-3">
                    <button onClick={() => setJsonInput("")} className="flex-1 py-3 border border-slate-600 text-slate-400 rounded-lg">RESET</button>
                    <button onClick={handleManualJsonSubmit} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg">IMPORT</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default CinemaApp;