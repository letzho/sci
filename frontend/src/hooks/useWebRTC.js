import { useCallback, useEffect, useRef, useState } from 'react';
import { getPeerConnectionConfig, isProductionWebRtc } from '../utils/webrtcIce.js';

/**
 * Two-peer WebRTC for Agent ↔ Customer video. Signaling uses Socket.io on Render;
 * media is peer-to-peer with TURN fallback on production (different networks).
 */
export function useWebRTC({ socket, conversationId, role, displayName }) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('idle');
  const [mediaError, setMediaError] = useState(null);
  const [roomStatus, setRoomStatus] = useState({ agentPresent: false, clientPresent: false });
  const [iceDebug, setIceDebug] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const displayNameRef = useRef(displayName);
  const negotiatingRef = useRef(false);
  const forceRelayRef = useRef(false);
  const retriedRelayRef = useRef(false);
  const startNegotiationRef = useRef(null);

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
    const pc = new RTCPeerConnection(getPeerConnectionConfig({ forceRelay: forceRelayRef.current }));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', { conversationId, candidate: event.candidate });
      } else {
        socket.emit('webrtc-ice-candidate', { conversationId, candidate: null });
      }
    };

    pc.onicegatheringstatechange = () => {
      setIceDebug(`ICE gathering: ${pc.iceGatheringState}${forceRelayRef.current ? ' (TURN relay)' : ''}`);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      setIceDebug(`ICE: ${state}${forceRelayRef.current ? ' · relay mode' : ''}`);
      if (state === 'failed' && isProductionWebRtc() && !retriedRelayRef.current) {
        retriedRelayRef.current = true;
        forceRelayRef.current = true;
        console.warn('[useWebRTC] ICE failed — retrying with TURN relay only');
        resetPeerConnection();
        setConnectionState('connecting');
        startNegotiationRef.current?.();
      }
    };

    pc.ontrack = (event) => {
      const ms = remoteStreamRef.current;
      if (!ms.getTracks().some((t) => t.id === event.track.id)) {
        ms.addTrack(event.track);
      }
      // New object reference so React re-renders and <video> picks up tracks.
      const playable = new MediaStream(ms.getTracks());
      remoteStreamRef.current = playable;
      setRemoteStream(playable);
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }, [conversationId, resetPeerConnection, socket]);

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
  const startLocalMedia = useCallback(() => {
    if (localStreamRef.current) return Promise.resolve(localStreamRef.current);
    return navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      .then((stream) => {
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaError(null);
        return stream;
      })
      .catch((err) => {
        console.warn('[useWebRTC] getUserMedia failed:', err.message);
        setMediaError(err.message || 'Camera/microphone unavailable — tap Enable camera below');
        return null;
      });
  }, []);

  useEffect(() => {
    let active = true;
    startLocalMedia().then((stream) => {
      if (!active && stream) stream.getTracks().forEach((t) => t.stop());
    });
    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, [startLocalMedia]);

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

    const handleRoomStatus = (status) => {
      setRoomStatus((prev) => {
        if (role === 'client' && status.agentPresent && !prev.agentPresent) {
          socket.emit('request-call', { conversationId });
        }
        return status;
      });
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (candidate === null) return;
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

    const runAgentOffer = async () => {
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
        const offer = await pc.createOffer({ iceRestart: retriedRelayRef.current });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { conversationId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[useWebRTC] failed to create offer', err);
        resetPeerConnection();
      } finally {
        negotiatingRef.current = false;
      }
    };

    startNegotiationRef.current = runAgentOffer;

    const handleInitiateCall = async () => {
      await runAgentOffer();
    };

    const handleOffer = async ({ sdp }) => {
      if (role !== 'client') return;
      console.log('[useWebRTC] received offer, role=client');
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

  const reconnectVideo = useCallback(() => {
    retriedRelayRef.current = false;
    forceRelayRef.current = false;
    resetPeerConnection();
    setConnectionState('connecting');
    socket?.emit('join-room', { conversationId, role, displayName: displayNameRef.current });
    setTimeout(() => {
      if (role === 'agent') startNegotiationRef.current?.();
      else socket?.emit('request-call', { conversationId });
    }, 400);
  }, [conversationId, resetPeerConnection, role, socket]);

  const endCall = useCallback(() => {
    socket?.emit('end-call', { conversationId });
  }, [socket, conversationId]);

  return {
    localStream,
    remoteStream,
    connectionState,
    mediaError,
    roomStatus,
    iceDebug,
    toggleTrack,
    endCall,
    reconnectVideo,
    startLocalMedia,
  };
}
