import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../socket.js';
import IncomingCallBanner from './IncomingCallBanner.jsx';
import ClientConsentModal from './ClientConsentModal.jsx';

const STORAGE_KEY = 'sci_client_customer_id';
const CONSENT_KEY = 'sci_client_consent';

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
  const [consented, setConsented] = useState(() => {
    try {
      return localStorage.getItem(CONSENT_KEY) === '1';
    } catch {
      return true;
    }
  });

  function acceptConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, '1');
    } catch {
      /* noop */
    }
    setConsented(true);
  }

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  // Announce presence so the rep can ring this customer. The server maps
  // customerId -> socket.id, so the mapping goes STALE whenever the socket
  // reconnects (very common on mobile data / cross-network, and after a
  // sleeping backend wakes). Re-announcing on every `connect` keeps it fresh;
  // without this the rep sees "They're not online right now" even though the
  // customer has the portal open. Also fires on navigation and when the
  // customer picks their profile (custom event from ClientHome).
  useEffect(() => {
    const socket = getSocket();

    const announce = () => {
      const customerId = localStorage.getItem(STORAGE_KEY);
      if (customerId) socket.emit('register-customer', { customerId });
    };

    announce();
    socket.on('connect', announce);
    window.addEventListener('sci-customer-changed', announce);

    return () => {
      socket.off('connect', announce);
      window.removeEventListener('sci-customer-changed', announce);
    };
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

  if (!consented) {
    return <ClientConsentModal onAccept={acceptConsent} />;
  }

  return (
    <>
      {incomingCall && <IncomingCallBanner call={incomingCall} onAnswer={handleAnswer} onDecline={handleDecline} />}
      <Outlet />
    </>
  );
}
