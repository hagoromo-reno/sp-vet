import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { initDatabase } from './db/schema';
import { SessionManager } from './auth/sessionManager';
import { AdminService } from './admin/adminService';
import { CanineReferenceDriver } from './canineReferenceDriver';
import { NativePhysiologyWorker } from './nativePhysiologyWorker';
import {
  CANINE_MODEL_ID,
  PHYSIOLOGY_PROTOCOL_VERSION,
  type PhysiologyServerMessage,
} from '../src/physiology/protocol';

const app = express();
const httpServer = createServer(app);
const port = Number(process.env.PORT || process.env.APP_PORT || 3000);

app.use(express.json());

// CORS & Security headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-session-token');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware: Authenticate Session Token
const authenticateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization || (req.headers['x-session-token'] as string);
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;

  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token de autenticação não fornecido.' });
    return;
  }

  try {
    const { user, activeSession } = await SessionManager.validateAndHeartbeat(token);
    (req as any).user = user;
    (req as any).session = activeSession;
    next();
  } catch (error: any) {
    if (error.code === 'CONCURRENT_LOGIN_DETECTED') {
      res.status(401).json({
        error: 'CONCURRENT_LOGIN_DETECTED',
        message: 'Sua conta foi conectada em outro dispositivo. Conexões simultâneas não são permitidas pela assinatura.',
      });
      return;
    }
    if (error.code === 'TRIAL_EXPIRED' || error.code === 'SUBSCRIPTION_EXPIRED' || error.code === 'SUBSCRIPTION_INACTIVE') {
      res.status(403).json({ error: error.code, message: error.message });
      return;
    }
    res.status(401).json({ error: error.code || 'SESSION_INVALID', message: error.message || 'Sessão inválida.' });
  }
};

// Middleware: Require Admin Role
const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Acesso restrito ao administrador do sistema.' });
    return;
  }
  next();
};

// ---------------------------------------------------------------------------
// 1. PUBLIC AUTH ROUTES
// ---------------------------------------------------------------------------

app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Browser';

  if (!email || !password) {
    res.status(400).json({ error: 'INVALID_INPUT', message: 'Informe e-mail e senha.' });
    return;
  }

  try {
    const result = await SessionManager.login(email, password, ipAddress, userAgent);
    res.json({
      ok: true,
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    const status = error.code === 'TRIAL_EXPIRED' || error.code === 'SUBSCRIPTION_INACTIVE' ? 403 : 401;
    res.status(status).json({
      error: error.code || 'AUTH_FAILED',
      message: error.message || 'Erro ao realizar login.',
    });
  }
});

app.post('/api/auth/logout', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization || (req.headers['x-session-token'] as string);
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : null;
  if (token) {
    await SessionManager.logout(token);
  }
  res.json({ ok: true });
});

app.post('/api/auth/heartbeat', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const session = (req as any).session;
  res.json({
    ok: true,
    user,
    session: {
      id: session.id,
      lastHeartbeat: session.last_heartbeat_at,
    },
  });
});

app.get('/api/auth/me', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  res.json({
    ok: true,
    user: (req as any).user,
  });
});

// ---------------------------------------------------------------------------
// 2. PROFESSIONAL CLINICAL PERSPECTIVES & EVALUATIONS
// ---------------------------------------------------------------------------

app.post('/api/perspectives', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const { patientId, patientName, species, asaScore, conductSummary, clinicalNotes, telemetryData } = req.body;

  try {
    const created = await AdminService.saveProfessionalPerspective({
      userId: user.id,
      authorName: user.name,
      patientId,
      patientName,
      species,
      asaScore,
      conductSummary,
      clinicalNotes,
      telemetryData,
    });
    res.json({ ok: true, perspective: created });
  } catch (error: any) {
    res.status(500).json({ error: 'DB_ERROR', message: error.message });
  }
});

app.get('/api/perspectives', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  try {
    const list = await AdminService.listPerspectives(user.role === 'admin' ? undefined : user.id);
    res.json({ ok: true, perspectives: list });
  } catch (error: any) {
    res.status(500).json({ error: 'DB_ERROR', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// 3. ADMIN MANAGEMENT ROUTES
// ---------------------------------------------------------------------------

app.get('/api/admin/metrics', authenticateSession, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const metrics = await AdminService.getMetrics();
    res.json({ ok: true, metrics });
  } catch (error: any) {
    res.status(500).json({ error: 'METRICS_ERROR', message: error.message });
  }
});

app.get('/api/admin/users', authenticateSession, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const search = (req.query.search as string) || '';
  const status = (req.query.status as string) || '';
  try {
    const users = await AdminService.listUsers(search, status);
    res.json({ ok: true, users });
  } catch (error: any) {
    res.status(500).json({ error: 'USERS_ERROR', message: error.message });
  }
});

app.post('/api/admin/users', authenticateSession, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const created = await AdminService.createUser(req.body);
    res.json({ ok: true, user: created });
  } catch (error: any) {
    res.status(400).json({ error: 'CREATE_USER_ERROR', message: error.message });
  }
});

app.put('/api/admin/users/:id', authenticateSession, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await AdminService.updateUser(req.params.id, req.body);
    res.json({ ok: true, user: updated });
  } catch (error: any) {
    res.status(400).json({ error: 'UPDATE_USER_ERROR', message: error.message });
  }
});

app.delete('/api/admin/users/:id', authenticateSession, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await AdminService.deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'DELETE_USER_ERROR', message: error.message });
  }
});

app.get('/api/admin/sessions', authenticateSession, requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const sessions = await AdminService.listActiveSessions();
    res.json({ ok: true, sessions });
  } catch (error: any) {
    res.status(500).json({ error: 'SESSIONS_ERROR', message: error.message });
  }
});

app.post('/api/admin/sessions/:id/revoke', authenticateSession, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await AdminService.revokeSession(req.params.id);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'REVOKE_ERROR', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
    modelId: CANINE_MODEL_ID,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 4. STATIC PRODUCTION SERVING (SPA)
// ---------------------------------------------------------------------------
const distPath = resolve(process.cwd(), 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      next();
      return;
    }
    res.sendFile(resolve(distPath, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// 5. WEBSOCKET PHYSIOLOGY CHANNEL (Unified on the same HTTP server)
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server: httpServer, path: '/physiology' });
wss.on('connection', (socket) => {
  const send = (msg: PhysiologyServerMessage) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  };

  const referenceDriver = new CanineReferenceDriver();
  let nativeWorkerAvailable = false;
  const nativeWorker = new NativePhysiologyWorker(
    (message) => send(message),
    (reason) => {
      nativeWorkerAvailable = false;
      send({
        type: 'status',
        protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
        connected: true,
        nativeWorkerAvailable: false,
        modelId: CANINE_MODEL_ID,
        executionMode: 'shadow',
        validationGrade: 'not_validated',
        messagePt: 'Worker Pulse indisponível; o motor local continua ativo.',
      });
    }
  );

  socket.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      if (data.type === 'initialize') {
        referenceDriver.initialize(data.patient);
        send({
          type: 'ack',
          protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
          requestId: data.requestId || 'init-ack',
        });
      }
    } catch (e) {}
  });
});

// Boot and run
export async function startServer() {
  await initDatabase();
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`========================================================`);
    console.log(`🚀 SP-VET Servidor de Produção Ativo na porta ${port}`);
    console.log(`📡 Endereço HTTP/API: http://0.0.0.0:${port}`);
    console.log(`🔌 WebSocket Fisiológico: ws://0.0.0.0:${port}/physiology`);
    console.log(`========================================================`);
  });
  return httpServer;
}

if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}
