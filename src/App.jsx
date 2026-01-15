import React, { useState, useRef } from 'react';
import { Play, Pause, Square, Volume2 } from 'lucide-react';

const CinemaApp = () => {
  const [activeId, setActiveId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // DATA RUANGAN & NOMOR FILE
  // fileCode: Angka yang dipakai di nama file (pintu1.wav, pertunjukan1.wav)
  const theaters = [
    { id: 'kota1', name: 'KOTA 1', fileCode: '1', type: 'reguler' },
    { id: 'kota2', name: 'KOTA 2', fileCode: '2', type: 'reguler' },
    { id: 'kota3', name: 'KOTA 3', fileCode: '3', type: 'reguler' },
    // Asumsi Suite pakai nomor 4 (pintu4.wav). Jika pakai 'pintusuite.wav', ganti fileCode jadi 'suite'
    { id: 'suite', name: 'PREMIERE SUITE', fileCode: '4', type: 'vip' },
  ];

  const toggleAudio = (roomId, action) => {
    const targetId = `${roomId}-${action}`;
    const selectedTheater = theaters.find(t => t.id === roomId);

    // KASUS 1: Klik tombol yang sama (Play/Pause)
    if (activeId === targetId) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    } 
    // KASUS 2: Pindah lagu / Tombol baru
    else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // --- LOGIC PENAMAAN FILE BARU ---
      // action 'open'  -> pintuX.wav
      // action 'start' -> pertunjukanX.wav
      let fileName = "";
      if (action === 'open') {
        fileName = `pintu${selectedTheater.fileCode}.wav`;
      } else if (action === 'start') {
        fileName = `pertunjukan${selectedTheater.fileCode}.wav`;
      }

      const newAudio = new Audio(fileName);
      
      newAudio.onended = () => {
        setActiveId(null);
        setIsPlaying(false);
      };

      newAudio.onerror = () => {
        alert(`GAGAL: File tidak ditemukan!\nPastikan file "${fileName}" ada di folder public/audio`);
        setActiveId(null);
        setIsPlaying(false);
      };

      audioRef.current = newAudio;
      audioRef.current.play();
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

  // Komponen Tombol (UI Tetap Sama)
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
        <button
          onClick={() => toggleAudio(roomId, action)}
          className={`flex-1 flex items-center justify-start px-4 gap-3 transition-colors ${mainColorClass}`}
        >
          {isActive && isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          <span className="font-bold text-sm tracking-wide">{label}</span>
          {isActive && !isPlaying && <span className="text-xs ml-auto bg-black/20 px-2 py-1 rounded">PAUSED</span>}
        </button>

        <button
          onClick={stopAudio}
          className={`w-14 flex items-center justify-center border-l border-black/20 transition-colors 
            ${isActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-500'}
          `}
        >
          <Square size={18} fill="currentColor" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto mb-6 flex justify-between items-end border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-yellow-500 tracking-wider">CINEMA CONTROL</h1>
          <p className="text-slate-400 text-sm mt-1">Projectionist Audio Panel v2.1 (.wav support)</p>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={stopAudio}
                className="bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-200 px-4 py-2 rounded flex items-center gap-2"
            >
                <Square size={16} fill="currentColor"/> STOP ALL
            </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {theaters.map((theater) => (
          <div key={theater.id} className={`flex flex-col p-4 rounded-xl border shadow-xl relative overflow-hidden ${theater.type === 'vip' ? 'bg-slate-800 border-yellow-600/60' : 'bg-slate-800 border-slate-700'}`}>
            {theater.type === 'vip' && (
                <div className="absolute top-0 right-0 p-2 opacity-10"><Volume2 size={100} className="text-yellow-500" /></div>
            )}
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