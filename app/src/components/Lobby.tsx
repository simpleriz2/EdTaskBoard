'use client';
import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff } from 'lucide-react';

interface LobbyProps {
  roomId: string;
  onJoin: (userName: string, stream: MediaStream) => void;
}

export default function Lobby({ roomId, onJoin }: LobbyProps) {
  const [name, setName] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError('Camera/mic access denied. You can still join without video.'));

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCam = () => {
    stream?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCamOn((v) => !v);
  };

  const toggleMic = () => {
    stream?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMicOn((v) => !v);
  };

  const handleJoin = () => {
    if (!name.trim()) return;
    if (!stream) {
      // Join without media
      onJoin(name.trim(), new MediaStream());
      return;
    }
    onJoin(name.trim(), stream);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Join Room <span className="text-blue-400 font-mono">#{roomId}</span>
      </h1>

      {/* Camera preview */}
      <div className="relative w-72 h-52 bg-gray-800 rounded-xl overflow-hidden shadow-lg">
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${!camOn ? 'opacity-0' : ''}`}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-500 text-sm">
            {error || 'Requesting camera…'}
          </div>
        )}
        {!camOn && stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <VideoOff className="w-10 h-10 text-gray-500" />
          </div>
        )}
      </div>

      {/* Cam / Mic toggles */}
      <div className="flex gap-3">
        <button
          onClick={toggleCam}
          disabled={!stream}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
            ${camOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}
        >
          {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          {camOn ? 'Camera on' : 'Camera off'}
        </button>
        <button
          onClick={toggleMic}
          disabled={!stream}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
            ${micOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-500'}`}
        >
          {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          {micOn ? 'Mic on' : 'Mic off'}
        </button>
      </div>

      {/* Name input */}
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        className="w-72 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500
          focus:outline-none focus:border-blue-500 transition"
      />

      <button
        onClick={handleJoin}
        disabled={!name.trim()}
        className="w-72 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed
          font-medium transition text-sm"
      >
        Join Room →
      </button>
    </div>
  );
}
