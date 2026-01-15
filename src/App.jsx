import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Clock, CalendarClock, Tag, Trash2, PlusCircle, List } from 'lucide-react';

const CinemaApp = () => {
  // --- STATE SOUNDBOARD ---
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // --- STATE SCHEDULER (MULTI-QUEUE SYSTEM) ---
  // Input Form States
  const [inputTime, setInputTime] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [inputTarget, setInputTarget] = useState(""); 
  
  // The Queue (Daftar Antrian)
  const [scheduleQueue, setScheduleQueue] = useState([]);

  // DATA RUANGAN
  const theaters = [
    { id: 'kota1', name: 'KOTA 1', fileCode: '1', type: 'reguler' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2', type: 'reguler' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3', type: 'reguler' },
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4', type: 'vip' },
  ];

  // --- LOGIC SCHEDULER (MULTI) ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (scheduleQueue.length === 0) return;

      const now = new Date();
      const currentTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');

      // Cari jadwal yang waktunya SAMA dengan sekarang
      // Kita pakai filter dulu jaga-jaga kalau ada 2 jadwal di jam yang sama persis
      const jobsToRun = scheduleQueue.filter(job => job.time === currentTime);

      if (jobsToRun.length > 0) {
        // Ambil job pertama yang cocok
        const job = jobsToRun[0];
        
        // Eksekusi Audio
        const [roomId, action] = job.target.split('-');
        toggleAudio(roomId, action);
        
        // Hapus job tersebut dari antrian (Filter out)
        setScheduleQueue(prevQueue => prevQueue.filter(item => item.id !== job.id));

        // Opsional: Bunyikan notifikasi browser atau console
        console.log(`AUTO-PLAY: ${job.label}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduleQueue]);

  // Fungsi Tambah ke Antrian
  const handleAddSchedule = () => {
    if (!inputTime || !inputTarget || !inputLabel) return alert("Mohon lengkapi Jam, Label, dan Audio!");
    
    // Cari nama ruangan untuk display
    const [rId, act] = inputTarget.split('-');
    const rName = theaters.find(t => t.id === rId)?.name || rId;
    const actName = act === 'open' ? 'Pintu Buka' : 'Show Mulai';

    const newJob = {
      id: Date.now(), // Unique ID based on timestamp
      time: inputTime,
      label: inputLabel,
      target: inputTarget,
      displayAudio: `${rName} - ${actName}`
    };

    // Masukkan ke antrian lalu URUTKAN berdasarkan jam (Ascending)
    setScheduleQueue(prev => [...prev, newJob].sort((a, b) => a.time.localeCompare(b.time)));

    // Reset Form Input
    setInputLabel("");
    setInputTarget("");
    // Jam tidak direset agar operator enak kalau mau input jam yang berdekatan
  };

  // Fungsi Hapus Jadwal
  const handleDeleteJob = (idToDelete) => {
    setScheduleQueue(prev => prev.filter(job => job.id !== idToDelete));
  };

  // --- LOGIC AUDIO ---
  const toggleAudio = (roomId, action) => {
    const targetId = `${roomId}-${action}`;
    const selectedTheater = theaters.find(t => t.id === roomId);

    if (activeId === targetId) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      let fileName = "";
      if (action === 'open') fileName = `/pintu${selectedTheater.fileCode}.wav`;
      else if (action === 'start') fileName = `/pertunjukan${selectedTheater.fileCode}.wav`;

      const newAudio = new Audio(fileName);
      newAudio.onended = () => { setActiveId(null); setIsPlaying(false); };
      newAudio.onerror = () => { alert(`File audio tidak ditemukan: ${fileName}`); setActiveId(null); setIsPlaying(false); };

      audioRef.current = newAudio;
      audioRef.current.play().catch(e => console.error("Autoplay Blocked", e));
      setActiveId(targetId);
      setIsPlaying(true);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveId(null);
    setIsPlaying(false);
  };

  const AudioControl = ({ label, roomId, action }) => {
    const myId = `${roomId}-${action}`;
    const isActive = activeId === myId;
    
    let mainColorClass = "bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300";
    if (isActive) {
        mainColorClass = isPlaying 
            ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white animate-pulse" 
            : "bg-amber-600 hover:bg-amber-500 border-amber-500 text-white";
    }

    return (
      <div className="flex w-full h-16 rounded-lg overflow-hidden shadow-md border border-slate-600 mt-2">
        <button onClick={() => toggleAudio(roomId, action)} className={`flex-1 flex items-center justify-start px-4 gap-3 transition-colors ${mainColorClass}`}>
          {isActive && isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          <span className="font-bold text-sm tracking-wide">{label}</span>
          {isActive && !isPlaying && <span className="text-xs ml-auto bg-black/20 px-2 py-1 rounded">PAUSED</span>}
        </button>
        <button onClick={stopAudio} className={`w-14 flex items-center justify-center border-l border-black/20 transition-colors ${isActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-500'}`}>
          <Square size={18} fill="currentColor" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6 flex justify-between items-end border-b border-slate-700 pb-4">
        <div className="flex items-center gap-4">
          <img src="/logo1.png" alt="Cinema Logo" className="h-16 w-auto object-contain drop-shadow-lg" />
          <div>
            <h1 className="text-3xl font-bold text-yellow-500 tracking-wider">CINEMA CONTROL</h1>
            <p className="text-slate-400 text-sm mt-1">Multi-Scheduler System v4.0</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={stopAudio} className="bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-200 px-4 py-2 rounded flex items-center gap-2">
                <Square size={16} fill="currentColor"/> STOP ALL
            </button>
        </div>
      </div>

      {/* --- PANEL MULTI-SCHEDULER --- */}
      <div className="max-w-6xl mx-auto mb-8 bg-slate-800 border border-indigo-500/30 rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row gap-8">
        
        {/* BG Decoration */}
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><CalendarClock size={200} /></div>

        {/* KOLOM KIRI: INPUT FORM */}
        <div className="lg:w-1/3 relative z-10">
          <h3 className="text-indigo-400 font-bold mb-4 flex items-center gap-2 border-b border-indigo-500/30 pb-2">
            <PlusCircle size={20}/> TAMBAH JADWAL
          </h3>
          
          <div className="space-y-4">
             <div>
                <label className="block text-xs text-slate-400 mb-1">Set Jam (24h)</label>
                <input type="time" value={inputTime} onChange={(e) => setInputTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500 text-xl font-mono cursor-pointer" />
             </div>
             
             <div>
                <label className="block text-xs text-slate-400 mb-1">Label / Deskripsi</label>
                <div className="relative">
                    <Tag className="absolute left-3 top-3 text-slate-500" size={18}/>
                    <input type="text" placeholder="Ex: Moana Show 1" value={inputLabel} onChange={(e) => setInputLabel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-indigo-500 placeholder-slate-600" />
                </div>
             </div>

             <div>
                <label className="block text-xs text-slate-400 mb-1">Target Audio</label>
                <select value={inputTarget} onChange={(e) => setInputTarget(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer">
                    <option value="">-- Pilih Audio --</option>
                    {theaters.map(t => (
                    <optgroup key={t.id} label={t.name}>
                        <option value={`${t.id}-open`}>{t.name} - Pintu Dibuka</option>
                        <option value={`${t.id}-start`}>{t.name} - Show Mulai</option>
                    </optgroup>
                    ))}
                </select>
             </div>

             <button onClick={handleAddSchedule} disabled={!inputTime || !inputLabel || !inputTarget}
                className={`w-full font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2
                    ${(!inputTime || !inputLabel || !inputTarget) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-lg hover:shadow-indigo-500/50'}`}>
                <PlusCircle size={20} /> TAMBAHKAN KE LIST
             </button>
          </div>
        </div>

        {/* KOLOM KANAN: LIST QUEUE */}
        <div className="lg:w-2/3 relative z-10 flex flex-col h-full">
            <h3 className="text-emerald-400 font-bold mb-4 flex items-center justify-between border-b border-emerald-500/30 pb-2">
                <span className="flex items-center gap-2"><List size={20}/> LIST ANTRIAN ({scheduleQueue.length})</span>
                <span className="text-xs font-normal text-slate-500 italic">*Otomatis urut jam</span>
            </h3>

            <div className="flex-1 bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden min-h-[300px]">
                {scheduleQueue.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600">
                        <CalendarClock size={48} className="mb-2 opacity-50"/>
                        <p>Belum ada jadwal tayang</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto max-h-[350px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-800 text-slate-400 text-xs uppercase sticky top-0">
                                <tr>
                                    <th className="p-3">Jam</th>
                                    <th className="p-3">Deskripsi</th>
                                    <th className="p-3">Audio</th>
                                    <th className="p-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {scheduleQueue.map((job, index) => (
                                    <tr key={job.id} className="hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-3 font-mono font-bold text-emerald-400 text-lg">{job.time}</td>
                                        <td className="p-3 font-medium">{job.label}</td>
                                        <td className="p-3 text-sm text-indigo-300 flex items-center gap-2">
                                            <Volume2 size={14}/> {job.displayAudio}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => handleDeleteJob(job.id)} 
                                                className="text-slate-500 hover:text-red-500 p-2 rounded hover:bg-red-500/10 transition-all" title="Hapus Jadwal">
                                                <Trash2 size={18}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>

      </div>

      {/* Grid Layout Ruangan (SAMA) */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {theaters.map((theater) => (
          <div key={theater.id} className={`flex flex-col p-4 rounded-xl border shadow-xl relative overflow-hidden ${theater.type === 'vip' ? 'bg-slate-800 border-yellow-600/60' : 'bg-slate-800 border-slate-700'}`}>
            {theater.type === 'vip' && <div className="absolute top-0 right-0 p-2 opacity-10"><Volume2 size={100} className="text-yellow-500" /></div>}
            <div className="mb-4 z-10">
              <h2 className={`text-xl font-black uppercase tracking-tighter ${theater.type === 'vip' ? 'text-yellow-500' : 'text-slate-200'}`}>{theater.name}</h2>
              <div className={`h-1 w-12 mt-1 rounded ${theater.type === 'vip' ? 'bg-yellow-600' : 'bg-blue-600'}`}></div>
            </div>
            <div className="z-10 mt-auto space-y-3">
              <AudioControl roomId={theater.id} action="open" label="PINTU DIBUKA" />
              <AudioControl roomId={theater.id} action="start" label="SHOW MULAI" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CinemaApp;