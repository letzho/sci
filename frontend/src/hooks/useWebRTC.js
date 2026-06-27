import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * Minimal two-peer WebRTC helper for a real, live video call between the
 * Agent Console and the Client Portal. Signaling (offer/answer/ICE) is
 * relayed through the existing Socket.io connection - no separate
 * signaling server needed. Works great between two browser tabs/windows on
 * the same machine or LAN, which is exactly the live-demo scenario.
 */
export function useWebRTC({ socket, conversationId, role, displayName }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // idle | connecting | connected | failed | ended
  const [mediaError, setMediaError] = useState(null);
  const [roomStatus, setRoomStatus] = useState({ agentPresent: false, clientPresent: false });

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const displayNameRef = useRef(displayName);
  const negotiatingRef = useRef(false);

  useEffect(() => {
    displayNameRef.current = displayName;
  }, [displayName]);

  const resetPeerConnection = useCallback(() => {
    negotiatingRef.current = false;
    remoteDescSetRef.current = false;
    pendingCandidatesRef.current = [];
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {
        /* noop */
      }
      pcRef.current = null;
    }
    remoteStreamRef.current.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = new MediaStream();
    setRemoteStream(null);
  }, []);

  const waitForLocalStream = useCallback(() => {
    if (localStreamRef.current) return Promise.resolve(localStreamRef.current);
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (localStreamRef.current) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve(localStreamRef.current);
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(interval);
        resolve(localStreamRef.current); // may resolve null if permission was denied
      }, 5000);
    });
  }, []);

  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { conversationId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      // Add the incoming track to a persistent stream rather than replacing
      // the stream reference. This prevents ontrack firing during renegotiation
      // (e.g. when the remote side mutes a track) from nulling out the video.
      const ms = remoteStreamRef.current;
      if (!ms.getTracks().some((t) => t.id === event.track.id)) {
        ms.addTrack(event.track);
      }
      setRemoteStream(ms);
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [socket, conversationId]);

  const addLocalTracks = useCallback(
    async (pc) => {
      const stream = await waitForLocalStream();
      if (!stream) return;
      const existingTrackIds = new Set(pc.getSenders().map((s) => s.track?.id).filter(Boolean));
      stream.getTracks().forEach((track) => {
        if (!existingTrackIds.has(track.id)) pc.addTrack(track, stream);
      });
    },
    [waitForLocalStream]
  );

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    while (pendingCandidatesRef.current.length) {
      const candidate = pendingCandidatesRef.current.shift();
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn('[useWebRTC] failed to add queued ICE candidate', err);
      }
    }
  }, []);

  // Acquire local camera/mic once on mount.
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch((err) => {
        console.warn('[useWebRTC] getUserMedia failed:', err.message);
        setMediaError(err.message || 'Camera/microphone unavailable');
      });
    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Join the signaling room + wire up socket listeners for this conversation.
  useEffect(() => {
    if (!socket || !conversationId || !role) return undefined;

    const emitJoinRoom = () => {
      console.log(`[useWebRTC] emitting join-room, socket.id=${socket.id}, role=${role}`);
      socket.emit('join-room', { conversationId, role, displayName: displayNameRef.current });
    };

    const handleConnect = () => emitJoinRoom();
    if (socket.connected) emitJoinRoom();
    socket.on('connect', handleConnect);

    const handleRoomStatus = (status) => setRoomStatus(status);

    const handleInitiateCall = async () => {
      if (role !== 'agent') return;
      const existing = pcRef.current;
      if (existing?.connectionState === 'connected') return;
      if (negotiatingRef.current) return;

      negotiatingRef.current = true;
      if (existing && existing.signalingState !== 'closed') {
        resetPeerConnection();
      }

      setConnectionState('connecting');
      const pc = ensurePeerConnection();
      await addLocalTracks(pc);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { conversationId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[useWebRTC] failed to create offer', err);
        resetPeerConnection();
      } finally {
        negotiatingRef.current = false;
      }
    };

    const handleOffer = async ({ sdp }) => {
      if (role !== 'client') return;
      const existing = pcRef.current;
      if (existing?.connectionState === 'connected') return;
      if (negotiatingRef.current) return;

      negotiatingRef.current = true;
      if (existing && existing.signalingState !== 'closed') {
        resetPeerConnection();
      }

      setConnectionState('connecting');
      const pc = ensurePeerConnection();
      await addLocalTracks(pc);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { conversationId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[useWebRTC] failed to handle offer', err);
        resetPeerConnection();
      } finally {
        negotiatingRef.current = false;
      }
    };

    const handleAnswer = async ({ sdp }) => {
      if (role !== 'agent') return;
      const pc = pcRef.current;
      if (!pc || pc.signalingState !== 'have-local-offer') return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        remoteDescSetRef.current = true;
        await flushPendingCandidates();
      } catch (err) {
        console.error('[useWebRTC] failed to handle answer', err);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (pc && remoteDescSetRef.current) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn('[useWebRTC] failed to add ICE candidate', err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handlePeerDisconnected = () => {
      setConnectionState('idle');
      setRemoteStream(null);
    };

    const handleCallEnded = () => {
      setConnectionState('ended');
    };

    socket.on('room-status', handleRoomStatus);
    socket.on('initiate-call', handleInitiateCall);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('peer-disconnected', handlePeerDisconnected);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.emit('leave-room', { conversationId });
      socket.off('connect', handleConnect);
      socket.off('room-status', handleRoomStatus);
      socket.off('initiate-call', handleInitiateCall);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('peer-disconnected', handlePeerDisconnected);
      socket.off('call-ended', handleCallEnded);
      resetPeerConnection();
      setConnectionState('idle');
    };
  }, [socket, conversationId, role, ensurePeerConnection, addLocalTracks, flushPendingCandidates, resetPeerConnection]);

  const toggleTrack = useCallback((kind, enabled) => {
    localStreamRef.current?.getTracks().forEach((t) => {
      if (t.kind === kind) t.enabled = enabled;
    });
  }, []);

  const endCall = useCallback(() => {
    socket?.emit('end-call', { conversationId });
  }, [socket, conversationId]);

  return { localStream, remoteStream, connectionState, mediaError, roomStatus, toggleTrack, endCall };
}
