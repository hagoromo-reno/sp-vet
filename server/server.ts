import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { WebSocketServer, WebSocket } from 'ws';
import { initDatabase } from './db/schema';
import { SessionManager } from './auth/sessionManager';
import { AdminService } from './admin/adminService';
import { LicenseService } from './services/licenseService';
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
// 1.5 AUTOMATED LIFETIME LICENSE & ASAAS / AOL SMTP ROUTES
// ---------------------------------------------------------------------------

// A.1 Novo Fluxo: Iniciar Pedido Seguro Asaas com Nome, E-mail e CPF obrigatórios
app.post('/api/license/create-order', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, cpf, phone } = req.body;
    const result = await LicenseService.initiateOrder({ name, email, cpf, phone });
    // Grava cookie para reconhecimento automático do aparelho
    res.cookie('anest_order_token', result.orderToken, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'lax',
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'CREATE_ORDER_ERROR', message: error.message || 'Erro ao gerar pedido de licença.' });
  }
});

// A.2 Consulta em tempo real do pedido pelo token da sessão do aparelho (cookie, query ou header)
app.get('/api/license/check-order-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const cookieHeader = req.headers.cookie;
    let cookieToken: string | undefined;
    if (cookieHeader) {
      const match = cookieHeader.match(/(^|;\s*)anest_order_token=([^;]*)/);
      if (match) cookieToken = decodeURIComponent(match[2]);
    }
    const token = (req.query.token as string) || (req.headers['x-order-token'] as string) || cookieToken;
    if (!token) {
      res.status(400).json({ error: 'NO_TOKEN', message: 'Token de pedido não fornecido.' });
      return;
    }
    const status = await LicenseService.checkCheckoutStatus(token);
    res.json(status);
  } catch (error: any) {
    res.status(400).json({ error: 'CHECK_ORDER_ERROR', message: error.message || 'Erro ao consultar pedido.' });
  }
});

// A.3 Conclusão do cadastro com definição de senha (após confirmação do pagamento pelo Asaas)
app.post('/api/license/complete-registration', async (req: Request, res: Response): Promise<void> => {
  try {
    const cookieHeader = req.headers.cookie;
    let cookieToken: string | undefined;
    if (cookieHeader) {
      const match = cookieHeader.match(/(^|;\s*)anest_order_token=([^;]*)/);
      if (match) cookieToken = decodeURIComponent(match[2]);
    }
    const { orderToken, password, passwordConfirm } = req.body;
    const token = orderToken || (req.headers['x-order-token'] as string) || cookieToken;

    if (!token) {
      res.status(400).json({ error: 'MISSING_TOKEN', message: 'Sessão do pedido não localizada.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'INVALID_PASSWORD', message: 'A senha deve possuir pelo menos 6 caracteres.' });
      return;
    }
    if (passwordConfirm && password !== passwordConfirm) {
      res.status(400).json({ error: 'PASSWORD_MISMATCH', message: 'As senhas digitadas não coincidem.' });
      return;
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';

    const result = await LicenseService.completeRegistrationWithPassword(
      token,
      password,
      ipAddress,
      userAgent
    );

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'COMPLETE_REGISTRATION_ERROR', message: error.message || 'Erro ao concluir cadastro.' });
  }
});

// A.4 Recuperação de pedido ou pagamento anterior por CPF ou E-mail
app.post('/api/license/recover-order', async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ error: 'MISSING_IDENTIFIER', message: 'Informe o CPF ou E-mail da compra.' });
      return;
    }
    const result = await LicenseService.recoverOrderByCpfOrEmail(identifier);
    if (result.found && result.orderToken) {
      res.setHeader('Set-Cookie', `anest_order_token=${result.orderToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'RECOVER_ORDER_ERROR', message: error.message || 'Erro ao consultar pedido anterior.' });
  }
});

// A. Cadastro inicial para compra da licença promocional (R$ 5,00) + Envio do código por e-mail (legado)
app.post('/api/license/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, cpf, phone } = req.body;
    const result = await LicenseService.registerForLicense({
      name,
      email,
      passwordPlain: password,
      cpf,
      phone,
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'REGISTRATION_ERROR', message: error.message || 'Erro ao registrar para compra.' });
  }
});

// B. Reenvio de código de confirmação de e-mail via AOL SMTP
app.post('/api/license/resend-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'INVALID_INPUT', message: 'E-mail obrigatório.' });
      return;
    }
    const result = await LicenseService.resendVerificationCode(email);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'RESEND_ERROR', message: error.message || 'Erro ao reenviar código.' });
  }
});

// C. Confirmação do e-mail + Geração automática da cobrança Asaas de R$ 49,90 (PIX / Cartão)
app.post('/api/license/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Browser';

    if (!email || !code) {
      res.status(400).json({ error: 'INVALID_INPUT', message: 'E-mail e código de verificação são obrigatórios.' });
      return;
    }

    const result = await LicenseService.verifyEmailAndCreateCharge(email, code, ipAddress, userAgent);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: 'VERIFICATION_ERROR', message: error.message || 'Erro ao validar código.' });
  }
});

// D. Consulta de status do pedido de licença em tempo real (usuário autenticado)
app.get('/api/license/order-status', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const statusData = await LicenseService.getOrderStatus(user.id);
    res.json({ ok: true, ...statusData });
  } catch (error: any) {
    res.status(500).json({ error: 'ORDER_STATUS_ERROR', message: error.message });
  }
});

// E. Verificação forçada de pagamento pelo usuário (botão "Já Paguei / Checar Agora")
app.post('/api/license/check-payment', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const statusData = await LicenseService.getOrderStatus(user.id);
    res.json({ ok: true, ...statusData });
  } catch (error: any) {
    res.status(500).json({ error: 'CHECK_PAYMENT_ERROR', message: error.message });
  }
});

// E.2 Processamento Direto de Cartão de Crédito
app.post('/api/license/pay-credit-card', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { card } = req.body;
    if (!card || !card.number || !card.holderName || !card.expiryMonth || !card.expiryYear || !card.ccv) {
      res.status(400).json({ error: 'INVALID_CARD', message: 'Preencha todos os dados do cartão de crédito.' });
      return;
    }
    const result = await LicenseService.payOrderWithCreditCard(user.id, card);
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(400).json({ error: 'CARD_PAYMENT_ERROR', message: error.message || 'Falha ao processar cartão.' });
  }
});

// F. WEBHOOK DO BANCO ASAAS (Recebe confirmação de pagamento e ativa licença + envia e-mail)
app.post('/api/webhooks/asaas', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeaderToken = (req.headers['asaas-access-token'] as string) || (req.query.token as string);
    const { event, payment } = req.body;

    console.log(`[Webhook Asaas] Recebido evento: ${event} para cobrança: ${payment?.id}`);

    const result = await LicenseService.handleAsaasWebhook(event, payment, authHeaderToken);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('[Webhook Asaas] Erro no processamento:', error.message);
    res.status(400).json({ error: 'WEBHOOK_ERROR', message: error.message });
  }
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
// 2.5 REVISÕES POR ANESTESIOLOGISTA (PostgreSQL)
// ---------------------------------------------------------------------------

app.post('/api/reviews', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const {
    id,
    runId,
    snapshotId,
    reviewer,
    qualification,
    verdict,
    confidence,
    expectedRanges,
    expectedNarrative,
    rationale,
    relatedEventId,
    expectedResponseSeconds,
    patientId,
    patientName,
    species,
    asaStatus,
    runData,
  } = req.body;

  if (!runId || !snapshotId || !reviewer || !verdict || !expectedNarrative || !rationale) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'Campos obrigatórios de revisão ausentes.' });
    return;
  }

  try {
    const saved = await AdminService.saveReview({
      id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      runId,
      snapshotId,
      reviewer,
      qualification: qualification || user.name,
      verdict,
      confidence: confidence || 'medium',
      expectedRanges,
      expectedNarrative,
      rationale,
      relatedEventId,
      expectedResponseSeconds,
      patientId,
      patientName,
      species,
      asaStatus,
      runData,
    });
    res.json({ ok: true, review: saved });
  } catch (error: any) {
    res.status(500).json({ error: 'SAVE_REVIEW_ERROR', message: error.message });
  }
});

app.get('/api/reviews', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  try {
    const reviews = await AdminService.listReviews({
      userId: user.id,
      isAdmin: user.role === 'admin',
    });
    res.json({ ok: true, reviews });
  } catch (error: any) {
    res.status(500).json({ error: 'LIST_REVIEWS_ERROR', message: error.message });
  }
});

app.delete('/api/reviews/:id', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  try {
    await AdminService.deleteReview(req.params.id, user.id, user.role === 'admin');
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'DELETE_REVIEW_ERROR', message: error.message });
  }
});

// ---------------------------------------------------------------------------
// 2.6 GESTÃO DE PACIENTES (Padrão & Personalizados no PostgreSQL)
// ---------------------------------------------------------------------------

app.get('/api/patients', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  try {
    const patients = await AdminService.listPatients({
      userId: user.id,
      isAdmin: user.role === 'admin',
    });
    res.json({ ok: true, patients });
  } catch (error: any) {
    res.status(500).json({ error: 'LIST_PATIENTS_ERROR', message: error.message });
  }
});

app.post('/api/patients', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  const {
    id,
    name,
    species,
    breed,
    gender,
    ageYears,
    ageMonths,
    weightKg,
    asa,
    scenarioTitle,
    scenarioDescription,
    clinicalHistory,
    surgicalProcedure,
    profileData,
  } = req.body;

  if (!name || !species || weightKg === undefined || !asa || !profileData) {
    res.status(400).json({ error: 'MISSING_FIELDS', message: 'Dados essenciais do paciente ausentes.' });
    return;
  }

  try {
    const saved = await AdminService.savePatient({
      id,
      userId: user.id,
      name,
      species,
      breed,
      gender,
      ageYears,
      ageMonths,
      weightKg: Number(weightKg),
      asa,
      scenarioTitle,
      scenarioDescription,
      clinicalHistory,
      surgicalProcedure,
      profileData,
    });
    res.json({ ok: true, patient: saved });
  } catch (error: any) {
    res.status(500).json({ error: 'SAVE_PATIENT_ERROR', message: error.message });
  }
});

app.delete('/api/patients/:id', authenticateSession, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  try {
    await AdminService.deletePatient(req.params.id, user.id, user.role === 'admin');
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'DELETE_PATIENT_ERROR', message: error.message });
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
    console.log(`🚀 anest-vet Servidor de Produção Ativo na porta ${port}`);
    console.log(`📡 Endereço HTTP/API: http://0.0.0.0:${port}`);
    console.log(`🔌 WebSocket Fisiológico: ws://0.0.0.0:${port}/physiology`);
    console.log(`========================================================`);
  });
  return httpServer;
}

if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer();
}
