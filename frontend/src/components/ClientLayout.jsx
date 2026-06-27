import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../socket.js';
import IncomingCallBanner from './IncomingCallBanner.jsx';

const STORAGE_KEY = 'sci_client_customer_id';

/**
 * Shared wrapper for every /client/* route (mirrors AgentLayout on the
 * Agent Console side). Two jobs:
 *  1. Registers this browser tab's socket as the customer's "presence" so
 *     the backend can ring them on the home/policy screens, not just while
 *     they're already on the call screen.
 *  2. Listens for `incoming-call` and renders a full-screen alert with
 *     Answer / Decline, regardless of which Client Portal page is active.
 */
export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Re-announce presence on every navigation - cheap and idempotent, and
  // covers the case where the customer picks/switches their demo profile.
  useEffect(() => {
    const customerId = localStorage.getItem(STORAGE_KEY);
    if (customerId) getSocket().emit('register-customer', { customerId });
  }, [location.pathname]);

  useEffect(() => {
    const socket = getSocket();

    function handleIncomingCall(payload) {
      // Already on that exact call screen - nothing to alert about.
      if (pathnameRef.current === `/client/call/${payload.conversationId}`) return;
      setIncomingCall(payload);
    }
    function handleCallEnded() {
      setIncomingCall(null);
    }

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-ended', handleCallEnded);
    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-ended', handleCallEnded);
    };
  }, []);

  function handleAnswer() {
    const conversationId = incomingCall?.conversationId;
    setIncomingCall(null);
    if (conversationId) navigate(`/client/call/${conversationId}`);
  }

  function handleDecline() {
    if (incomingCall?.conversationId) {
      getSocket().emit('call-declined', { conversationId: incomingCall.conversationId });
    }
    setIncomingCall(null);
  }

  return (
    <>
      {incomingCall && <IncomingCallBanner call={incomingCall} onAnswer={handleAnswer} onDecline={handleDecline} />}
      <Outlet />
    </>
  );
}
