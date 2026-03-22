'use client';
import { useRef, useState } from 'react';
import { VideoOff, MicOff, Video, Mic } from 'lucide-react';
import { Rnd } from 'react-rnd';
import { Peer } from '@/hooks/useWebRTC';

interface VideoOverlayProps {
  localStream: MediaStream;
  peers: Map<string, Peer>;
  userName: string;
  toggleVideo: () => void;
  toggleAudio: () => void;
}

function VideoCard({
  stream,
  label,
  muted = false,
  controls,
}: {
  stream: MediaStream;
  label: string;
  muted?: boolean;
  controls?: React.ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  // Attach stream to video element
  if (ref.current && ref.current.srcObject !== stream) {
    ref.current.srcObject = stream;
  }

  return (
    <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-700">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      {/* Name badge */}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-white text-xs truncate">
        {label}
      </div>
      {/* Controls (local only) */}
      {controls && (
        <div className="absolute top-1 right-1 flex gap-1">{controls}</div>
      )}
    </div>
  );
}

function ToggleBtn({
  onClick,
  active,
  OnIcon,
  OffIcon,
}: {
  onClick: () => void;
  active: boolean;
  OnIcon: React.ElementType;
  OffIcon: React.ElementType;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 flex items-center justify-center rounded-full text-white transition
        ${active ? 'bg-gray-700/80 hover:bg-gray-600' : 'bg-red-600/80 hover:bg-red-500'}`}
    >
      {active ? <OnIcon className="w-3.5 h-3.5" /> : <OffIcon className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function VideoOverlay({
  localStream,
  peers,
  userName,
  toggleVideo,
  toggleAudio,
}: VideoOverlayProps) {
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const defaultW = 200;
  const defaultH = 150;
  const baseX = typeof window !== 'undefined' ? window.innerWidth - defaultW - 20 : 20;
  const baseY = typeof window !== 'undefined' ? window.innerHeight - defaultH - 20 : 20;

  const handleToggleVideo = () => { toggleVideo(); setCamOn((v) => !v); };
  const handleToggleAudio = () => { toggleAudio(); setMicOn((v) => !v); };

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }}>
      {/* Local video */}
      <Rnd
        default={{ x: baseX, y: baseY, width: defaultW, height: defaultH }}
        minWidth={150}
        minHeight={112}
        style={{ pointerEvents: 'auto' }}
        bounds="parent"
      >
        <VideoCard
          stream={localStream}
          label={`${userName} (you)`}
          muted
          controls={
            <>
              <ToggleBtn onClick={handleToggleVideo} active={camOn} OnIcon={Video} OffIcon={VideoOff} />
              <ToggleBtn onClick={handleToggleAudio} active={micOn} OnIcon={Mic} OffIcon={MicOff} />
            </>
          }
        />
      </Rnd>

      {/* Remote peers */}
      {Array.from(peers.entries()).map(([userId, peer], idx) => (
        <Rnd
          key={userId}
          default={{
            x: baseX,
            y: Math.max(10, baseY - (idx + 1) * (defaultH + 10)),
            width: defaultW,
            height: defaultH,
          }}
          minWidth={150}
          minHeight={112}
          style={{ pointerEvents: 'auto' }}
          bounds="parent"
        >
          <VideoCard stream={peer.stream} label={peer.userName} />
        </Rnd>
      ))}
    </div>
  );
}
