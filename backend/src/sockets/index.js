const db = require('../db/connection');
const orchestrator = require('../agents/orchestrator');
const adminAgent = require('../agents/adminAgent');
const quizAgent = require('../agents/quizAgent');
const needsSurveyAgent = require('../agents/needsSurveyAgent');
const { getQuiz } = require('../data/quizQuestions');
const { getNeedsSurvey } = require('../data/needsSurveyQuestions');

/**
 * Real-time layer for the Virtual Call and Chat channels.
 *
 * Room model: one Socket.io room per conversationId, holding at most one
 * "agent" socket and one "client" socket. The Agent Console and Client
 * Portal each call POST /api/conversations/start independently to resolve
 * the same conversationId (no manual codes to copy), then both join the
 * matching socket room here.
 *
 * In-memory room registry: { [conversationId]: { agentSocketId, clientSocketId } }
 * This is intentionally in-memory (not persisted) - it only tracks who is
 * currently connected, which is inherently transient.
 */
const rooms = new Map();

/**
 * Lightweight presence registry so the Client Portal can receive a real
 * "incoming call" push even while sitting on a screen that isn't tied to
 * any particular conversation yet (e.g. the home/profile picker). Keyed by
 * customerId -> the customer's current socket id. Intentionally in-memory,
 * same rationale as `rooms` above.
 */
const customerPresence = new Map();

function getRoom(conversationId) {
  if (!rooms.has(conversationId)) {
    rooms.set(conversationId, { agentSocketId: null, clientSocketId: null });
  }
  return rooms.get(conversationId);
}

function roomStatus(room) {
  return { agentPresent: Boolean(room.agentSocketId), clientPresent: Boolean(room.clientSocketId) };
}

async function endConversation(conversationId) {
  try {
    await db.prepare(`UPDATE conversations SET status = 'ended', ended_at = ${db.NOW_EXPR} WHERE id = ? AND status = 'active'`).run(
      conversationId
    );
  } catch (err) {
    console.error('[sockets] failed to mark conversation ended:', err.message);
  }
}

function initSockets(io) {
  io.on('connection', (socket) => {
    socket.data.conversationId = null;
    socket.data.role = null;
    socket.data.customerId = null;

    // Customer Portal registers presence on mount (any /client/* page), so an
    // agent starting a virtual call can ring them even if they aren't yet on
    // a call screen. Idempotent - safe to call again on every navigation.
    socket.on('register-customer', ({ customerId } = {}) => {
      if (!customerId) return;
      socket.data.customerId = customerId;
      customerPresence.set(customerId, socket.id);
    });

    socket.on('join-room', async ({ conversationId, role, displayName } = {}) => {
      if (!conversationId || !['agent', 'client'].includes(role)) return;

      socket.join(conversationId);
      socket.data.conversationId = conversationId;
      socket.data.role = role;
      socket.data.displayName = displayName || (role === 'agent' ? 'Representative' : 'Customer');

      const room = getRoom(conversationId);
      const customerNotYetInRoom = role === 'agent' && !room.clientSocketId;

      if (role === 'agent') room.agentSocketId = socket.id;
      else room.clientSocketId = socket.id;

      io.to(conversationId).emit('room-status', roomStatus(room));

      // Only the agent creates the WebRTC offer — the client always answers.
      // This prevents both sides racing to create offers (SDP glare).
      if (room.agentSocketId && room.clientSocketId) {
        io.to(room.agentSocketId).emit('initiate-call', { conversationId });
      }

      // Ring the customer's device for a virtual call: if they're online
      // elsewhere in the Client Portal but not yet in this room, push a
      // real "incoming call" notification rather than leaving them to
      // stumble onto the call screen on their own.
      if (customerNotYetInRoom) {
        try {
          const convo = await db.prepare(`SELECT customer_id, channel FROM conversations WHERE id = ?`).get(conversationId);
          if (convo?.channel === 'virtual_call') {
            const presenceSocketId = customerPresence.get(convo.customer_id);
            if (presenceSocketId) {
              io.to(presenceSocketId).emit('incoming-call', {
                conversationId,
                agentName: socket.data.displayName,
              });
              socket.emit('call-ringing', { reached: true });
            } else {
              socket.emit('call-ringing', { reached: false });
            }
          }
        } catch (err) {
          console.error('[sockets] incoming-call lookup failed:', err.message);
        }
      }
    });

    // Customer dismissed the incoming-call alert without joining.
    socket.on('call-declined', ({ conversationId } = {}) => {
      if (!conversationId) return;
      const room = getRoom(conversationId);
      if (room.agentSocketId) {
        io.to(room.agentSocketId).emit('call-declined', {});
      }
    });

    socket.on('leave-room', ({ conversationId } = {}) => {
      cleanupSocketFromRoom(io, socket, conversationId || socket.data.conversationId);
    });

    // ---- WebRTC signaling relay (server never inspects SDP/ICE contents) ----
    socket.on('webrtc-offer', ({ conversationId, sdp }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('webrtc-offer', { sdp });
    });

    socket.on('webrtc-answer', ({ conversationId, sdp }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('webrtc-answer', { sdp });
    });

    socket.on('webrtc-ice-candidate', ({ conversationId, candidate }) => {
      if (!conversationId) return;
      socket.to(conversationId).emit('webrtc-ice-candidate', { candidate });
    });

    // ---- Live guidance during a virtual call, driven by the customer's speech ----
    socket.on('customer-speech', async ({ conversationId, text, productType } = {}) => {
      if (!conversationId || !text || !text.trim()) return;
      const room = getRoom(conversationId);

      // Emit only to sockets in this room that belong to the agent role.
      // Using the room broadcast avoids stale socket-ID lookups entirely —
      // the customer's ClientCall.jsx has no guidance-update listener so they
      // never see this event.
      function emitToAgents(event, payload) {
        io.in(conversationId).fetchSockets().then((sockets) => {
          sockets.filter((s) => s.data.role === 'agent').forEach((s) => s.emit(event, payload));
          console.log(`[sockets] ${event} → ${sockets.filter((s) => s.data.role === 'agent').length} agent socket(s) in room ${conversationId}`);
        }).catch((err) => console.error('[sockets] fetchSockets error:', err.message));
      }

      emitToAgents('transcript-update', { text, at: new Date().toISOString() });

      try {
        const convo = await db.prepare(`SELECT product_context FROM conversations WHERE id = ?`).get(conversationId);
        const guidance = await orchestrator.getLiveGuidance({
          text,
          productType: productType || convo?.product_context,
        });
        await adminAgent.logMessage({ conversationId, sender: 'customer', kind: 'transcript', content: text });
        await adminAgent.logGuidance(conversationId, guidance);

        emitToAgents('guidance-update', { guidance });
      } catch (err) {
        console.error('[sockets] customer-speech guidance error:', err.message);
      }
    });

    // ---- Chat channel: customer <-> agent, with AI-drafted replies for review ----
    socket.on('chat-message', async ({ conversationId, sender, text, productType } = {}) => {
      if (!conversationId || !sender || !text || !text.trim()) return;
      const room = getRoom(conversationId);

      await adminAgent.logMessage({ conversationId, sender, kind: 'text', content: text });
      socket.to(conversationId).emit('chat-message', { sender, text, at: new Date().toISOString() });

      if (sender === 'customer') {
        try {
          const convo = await db.prepare(`SELECT product_context FROM conversations WHERE id = ?`).get(conversationId);
          const draft = await orchestrator.getChatDraft({
            customerMessage: text,
            productType: productType || convo?.product_context,
            conversationId,
          });
          await adminAgent.logMessage({ conversationId, sender: 'ai', kind: 'draft', content: draft.draftReply });

          if (room.agentSocketId) {
            io.to(room.agentSocketId).emit('chat-draft', { draft });
          }
        } catch (err) {
          console.error('[sockets] chat-message draft error:', err.message);
        }
      }
    });

    // Agent reviewed/edited the draft (or wrote a fresh reply) and sends it on.
    socket.on('agent-send-approved', async ({ conversationId, text } = {}) => {
      if (!conversationId || !text || !text.trim()) return;
      await adminAgent.logMessage({ conversationId, sender: 'agent', kind: 'approved', content: text });
      socket.to(conversationId).emit('chat-message', { sender: 'agent', text, at: new Date().toISOString() });
    });

    // ---- Virtual call tools: quiz, coffee chat, calculator share ----
    function emitToClients(conversationId, event, payload) {
      io.in(conversationId)
        .fetchSockets()
        .then((sockets) => {
          sockets.filter((s) => s.data.role === 'client').forEach((s) => s.emit(event, payload));
        })
        .catch((err) => console.error('[sockets] emitToClients error:', err.message));
    }

    function emitToAgents(conversationId, event, payload) {
      io.in(conversationId)
        .fetchSockets()
        .then((sockets) => {
          sockets.filter((s) => s.data.role === 'agent').forEach((s) => s.emit(event, payload));
        })
        .catch((err) => console.error('[sockets] emitToAgents error:', err.message));
    }

    socket.on('quiz-start', async ({ conversationId, productType } = {}) => {
      if (!conversationId) return;
      const quiz = getQuiz(productType);
      emitToClients(conversationId, 'quiz-start', { quiz, productType });
      await adminAgent.logMessage({
        conversationId,
        sender: 'agent',
        kind: 'quiz',
        content: JSON.stringify({ action: 'started', title: quiz.title }),
      });
    });

    socket.on('quiz-submit', async ({ conversationId, productType, answers, customerName } = {}) => {
      if (!conversationId || !answers) return;
      try {
        const grade = await quizAgent.gradeQuiz({ productType, answers, customerName });
        emitToAgents(conversationId, 'quiz-result', { grade });
        emitToClients(conversationId, 'quiz-result', { grade: { score: grade.score, total: grade.total, aiFeedback: grade.aiFeedback } });
        await adminAgent.logMessage({
          conversationId,
          sender: 'customer',
          kind: 'quiz',
          content: JSON.stringify({ action: 'submitted', score: grade.score, total: grade.total }),
        });
      } catch (err) {
        console.error('[sockets] quiz-submit error:', err.message);
      }
    });

    socket.on('coffee-chat-invite', async ({ conversationId, template, agentName } = {}) => {
      if (!conversationId || !template) return;
      emitToClients(conversationId, 'coffee-chat-invite', { template, agentName });
      await adminAgent.logMessage({
        conversationId,
        sender: 'agent',
        kind: 'invite',
        content: JSON.stringify({ templateId: template.id, subject: template.subject }),
      });
    });

    socket.on('share-calculator', ({ conversationId, result } = {}) => {
      if (!conversationId || !result) return;
      emitToClients(conversationId, 'calculator-shared', { result });
    });

    socket.on('game-survey-start', async ({ conversationId, productType } = {}) => {
      if (!conversationId) return;
      const survey = getNeedsSurvey(productType);
      emitToClients(conversationId, 'game-survey-start', { survey, productType });
      await adminAgent.logMessage({
        conversationId,
        sender: 'agent',
        kind: 'game_survey',
        content: JSON.stringify({ action: 'started', title: survey.title }),
      });
    });

    socket.on('game-survey-submit', async ({ conversationId, productType, answers, gameChoice, customerName } = {}) => {
      if (!conversationId || !answers) return;
      try {
        const result = await needsSurveyAgent.summarizeNeedsSurvey({
          productType,
          answers,
          gameChoice,
          customerName,
        });
        emitToAgents(conversationId, 'game-survey-result', { result });
        emitToClients(conversationId, 'game-survey-complete', {
          result: { surveyTitle: result.surveyTitle, repBrief: result.repBrief },
        });
        await adminAgent.logMessage({
          conversationId,
          sender: 'customer',
          kind: 'game_survey',
          content: JSON.stringify({
            action: 'completed',
            gameChoice,
            insights: result.insights,
          }),
        });
      } catch (err) {
        console.error('[sockets] game-survey-submit error:', err.message);
      }
    });

    socket.on('end-call', async ({ conversationId } = {}) => {
      if (!conversationId) return;
      await endConversation(conversationId);
      io.to(conversationId).emit('call-ended', { conversationId });
    });

    socket.on('disconnect', () => {
      cleanupSocketFromRoom(io, socket, socket.data.conversationId);
      if (socket.data.customerId && customerPresence.get(socket.data.customerId) === socket.id) {
        customerPresence.delete(socket.data.customerId);
      }
    });
  });
}

function cleanupSocketFromRoom(io, socket, conversationId) {
  if (!conversationId || !rooms.has(conversationId)) return;
  const room = rooms.get(conversationId);
  if (room.agentSocketId === socket.id) room.agentSocketId = null;
  if (room.clientSocketId === socket.id) room.clientSocketId = null;

  if (!room.agentSocketId && !room.clientSocketId) {
    rooms.delete(conversationId);
  } else {
    io.to(conversationId).emit('room-status', roomStatus(room));
    io.to(conversationId).emit('peer-disconnected', { role: socket.data.role });
  }
}

module.exports = { initSockets };
