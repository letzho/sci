require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const { initSchema } = require('./src/db/init');
const { initSockets } = require('./src/sockets');

const authRoutes = require('./src/routes/auth.routes');
const agentsRoutes = require('./src/routes/agents.routes');
const customersRoutes = require('./src/routes/customers.routes');
const financialPlansRoutes = require('./src/routes/financialPlans.routes');
const policiesRoutes = require('./src/routes/policies.routes');
const conversationsRoutes = require('./src/routes/conversations.routes');
const messagesRoutes = require('./src/routes/messages.routes');
const guidanceRoutes = require('./src/routes/guidance.routes');
const knowledgeBaseRoutes = require('./src/routes/knowledgeBase.routes');
const documentsRoutes = require('./src/routes/documents.routes');
const policyUploadsRoutes = require('./src/routes/policyUploads.routes');
const metricsRoutes = require('./src/routes/metrics.routes');
const toolsRoutes = require('./src/routes/tools.routes');
const appointmentsRoutes = require('./src/routes/appointments.routes');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

/** Allow CLIENT_ORIGIN list, Vercel deployments, localhost, and LAN Vite dev. */
function isAllowedOrigin(origin) {
  if (!origin) return true;
  const allowed = CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    // Vercel production + preview URLs (each deploy gets a unique subdomain)
    if (host.endsWith('.vercel.app')) return true;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (url.port && url.port !== '5173') return false;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'clarityai-backend', time: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'clarityai-backend', health: '/api/health' });
});

app.use('/api/auth', authRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/customers', financialPlansRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/guidance', guidanceRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/policy-uploads', policyUploadsRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/appointments', appointmentsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
});
// Lets HTTP routes (e.g. policyUploads.routes.js) push real-time events to a
// conversation's Socket.io room without a circular import on server.js -
// req.app.get('io') is the standard Express pattern for this.
app.set('io', io);
initSockets(io);

// Schema creation is idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF
// NOT EXISTS) and safe to run on every boot. Demo data is seeded separately
// via `npm run seed` so restarting the server never wipes anything you've
// typed during a demo. initSchema() is async (Postgres access is a network
// round trip) so the listen() call waits for it to finish first.
initSchema()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`ClarityAI backend listening on http://localhost:${PORT}`);
      console.log(`Allowing requests from CLIENT_ORIGIN=${CLIENT_ORIGIN}`);
    });
  })
  .catch((err) => {
    console.error('[server] failed to initialize database schema:', err.message || err);
    console.error('[server] Check DATABASE_URL on Render (Supabase URI) and DATABASE_SSL=true');
    process.exit(1);
  });
