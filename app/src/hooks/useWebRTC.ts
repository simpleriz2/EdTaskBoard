import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export interface Peer {
  stream: MediaStream;
  userName: string;
}

// Env fallbacks (read at runtime from window or from NEXT_PUBLIC_*)
const TURN_URL  = process.env.NEXT_PUBLIC_TURN_URL  || 'turn:localhost:3478';
const TURN_USER = process.env.NEXT_PUBLIC_TURN_USER || 'test';
const TURN_CRED = process.env.NEXT_PUBLIC_TURN_CRED || 'test';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: TURN_URL, username: TURN_USER, credential: TURN_CRED },
];

export function useWebRTC(
  roomId: string,
  userName: string,
  localStream: MediaStream,
  socket: Socket,
) {
  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const pcs = useRef<Map<string, RTCPeerConnection>>(new Map());

  const addTracks = (pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  };

  const createPC = useCallback(
    (userId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcs.current.set(userId, pc);

      // Tracks must be added BEFORE createOffer
      addTracks(pc, localStream);

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        // userName comes from socket state – we may not have it yet, add placeholder
        setPeers((prev) => {
          const next = new Map(prev);
          const existing = next.get(userId);
          next.set(userId, { stream: remoteStream, userName: existing?.userName || userId });
          return next;
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', { target: userId, candidate: event.candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          pcs.current.delete(userId);
          setPeers((prev) => { const next = new Map(prev); next.delete(userId); return next; });
        }
      };

      return pc;
    },
    [localStream, socket],
  );

  useEffect(() => {
    // Existing users in room → we initiate offer
    socket.on('room-users', async (users: Record<string, { userName: string }>) => {
      for (const [userId, data] of Object.entries(users)) {
        // Update userName in peers map
        setPeers((prev) => {
          const next = new Map(prev);
          const existing = next.get(userId);
          if (existing) next.set(userId, { ...existing, userName: data.userName });
          return next;
        });

        const pc = createPC(userId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc-offer', { target: userId, offer });
        } catch (e) {
          console.error('[webrtc] offer error', e);
        }
      }
    });

    // New user joined → they will send us an offer. Seed their userName.
    socket.on('user-joined', ({ userId, userName: uName }: { userId: string; userName: string }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        if (!next.has(userId)) next.set(userId, { stream: new MediaStream(), userName: uName });
        return next;
      });
    });

    // Receive offer → create answer
    socket.on('webrtc-offer', async ({ source, offer }: { source: string; offer: RTCSessionDescriptionInit }) => {
      let pc = pcs.current.get(source);
      if (!pc) pc = createPC(source);
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { target: source, answer });
      } catch (e) {
        console.error('[webrtc] answer error', e);
      }
    });

    // Receive answer
    socket.on('webrtc-answer', async ({ source, answer }: { source: string; answer: RTCSessionDescriptionInit }) => {
      const pc = pcs.current.get(source);
      if (pc) {
        try { await pc.setRemoteDescription(answer); }
        catch (e) { console.error('[webrtc] setRemoteDescription error', e); }
      }
    });

    // ICE candidate
    socket.on('webrtc-ice-candidate', async ({ source, candidate }: { source: string; candidate: RTCIceCandidateInit }) => {
      const pc = pcs.current.get(source);
      if (pc) {
        try { await pc.addIceCandidate(candidate); }
        catch (e) { console.error('[webrtc] addIceCandidate error', e); }
      }
    });

    // User disconnected
    socket.on('user-left', (userId: string) => {
      const pc = pcs.current.get(userId);
      if (pc) { pc.close(); pcs.current.delete(userId); }
      setPeers((prev) => { const next = new Map(prev); next.delete(userId); return next; });
    });

    return () => {
      socket.off('room-users');
      socket.off('user-joined');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('user-left');
      // Close all peer connections
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
    };
  }, [socket, createPC]);

  const toggleVideo = useCallback(() => {
    localStream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    localStream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
  }, [localStream]);

  return { peers, toggleVideo, toggleAudio };
}
