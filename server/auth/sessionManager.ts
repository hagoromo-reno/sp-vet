import { query } from '../db/pool';
import { generateSessionToken, hashPassword, verifyPassword } from './crypto';
import { randomUUID } from 'node:crypto';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'veterinarian' | 'student';
  subscription_status: 'active' | 'inactive' | 'trial' | 'cancelled';
  subscription_expires_at: string | null;
  trial_days: number;
  max_concurrent_sessions: number;
  is_blocked: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token: string;
  ip_address: string;
  user_agent: string;
  is_active: boolean;
  last_heartbeat_at: string;
  created_at: string;
  revoked_reason: string | null;
}

// In-Memory Fallback Store (when DB is temporarily offline or in testing)
const memoryUsers = new Map<string, UserRecord & { password_hash: string }>();
const memorySessions = new Map<string, SessionRecord>();

// Seed in-memory fallback
const defaultAdminPassHash = hashPassword('admin123');
memoryUsers.set('admin@spvet.com', {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Administrador SP-VET',
  email: 'admin@spvet.com',
  password_hash: defaultAdminPassHash,
  role: 'admin',
  subscription_status: 'active',
  subscription_expires_at: null,
  trial_days: 7,
  max_concurrent_sessions: 1,
  is_blocked: false,
  created_at: new Date().toISOString(),
  last_login_at: null,
});

const defaultDemoPassHash = hashPassword('demo123');
const demoExpires = new Date();
demoExpires.setDate(demoExpires.getDate() + 7);
memoryUsers.set('demo@spvet.com', {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Médico Veterinário (Trial)',
  email: 'demo@spvet.com',
  password_hash: defaultDemoPassHash,
  role: 'veterinarian',
  subscription_status: 'trial',
  subscription_expires_at: demoExpires.toISOString(),
  trial_days: 7,
  max_concurrent_sessions: 1,
  is_blocked: false,
  created_at: new Date().toISOString(),
  last_login_at: null,
});

export class SessionManager {
  /**
   * Autentica usuário e impõe a política de SESSÃO ÚNICA (bloqueio de conexão concorrente).
   * Caso o usuário já tenha sessão aberta em outro dispositivo, ela é imediatamente invalidada.
   */
  static async login(
    email: string,
    passwordPlain: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{ user: UserRecord; token: string }> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Tenta buscar no PostgreSQL
    try {
      const userRes = await query(
        `SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1;`,
        [cleanEmail]
      );

      if (userRes.rows.length > 0) {
        const row = userRes.rows[0];
        const isValid = verifyPassword(passwordPlain, row.password_hash);
        if (!isValid) {
          throw new Error('Credenciais inválidas: e-mail ou senha incorretos.');
        }

        // Valida se usuário está bloqueado
        if (row.is_blocked) {
          throw new Error('Acesso bloqueado: esta conta foi suspensa pelo administrador.');
        }

        // Valida status da assinatura
        SessionManager.checkSubscriptionStatus(row);

        // IMPÕE CONEXÃO NÃO-CONCORRENTE: Revoga TODAS as sessões ativas anteriores deste usuário!
        await query(
          `UPDATE user_sessions 
           SET is_active = FALSE, revoked_reason = 'concurrency_limit' 
           WHERE user_id = $1 AND is_active = TRUE;`,
          [row.id]
        );

        // Cria nova sessão ativa exclusiva
        const token = generateSessionToken();
        const sessionId = randomUUID();
        await query(
          `INSERT INTO user_sessions (id, user_id, token, ip_address, user_agent, is_active, last_heartbeat_at)
           VALUES ($1, $2, $3, $4, $5, TRUE, NOW());`,
          [sessionId, row.id, token, ipAddress, userAgent]
        );

        // Atualiza último login
        await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1;`, [row.id]);

        const { password_hash, ...safeUser } = row;
        return { user: safeUser, token };
      }
    } catch (dbError: any) {
      if (dbError.message?.includes('Credenciais') || dbError.message?.includes('Acesso') || dbError.message?.includes('Assinatura') || dbError.message?.includes('Período')) {
        throw dbError;
      }
      console.warn('[SessionManager] DB falhou, utilizando fallback em memória:', dbError.message);
    }

    // 2. Fallback em memória (para testes / inicialização)
    const memUser = memoryUsers.get(cleanEmail);
    if (!memUser) {
      throw new Error('Credenciais inválidas: e-mail ou senha incorretos.');
    }
    if (!verifyPassword(passwordPlain, memUser.password_hash)) {
      throw new Error('Credenciais inválidas: e-mail ou senha incorretos.');
    }
    if (memUser.is_blocked) {
      throw new Error('Acesso bloqueado: esta conta foi suspensa pelo administrador.');
    }
    SessionManager.checkSubscriptionStatus(memUser);

    // Revoga sessões em memória para este usuário
    for (const [t, s] of memorySessions.entries()) {
      if (s.user_id === memUser.id && s.is_active) {
        s.is_active = false;
        s.revoked_reason = 'concurrency_limit';
      }
    }

    const token = generateSessionToken();
    const sessionRec: SessionRecord = {
      id: randomUUID(),
      user_id: memUser.id,
      token,
      ip_address: ipAddress,
      user_agent: userAgent,
      is_active: true,
      last_heartbeat_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      revoked_reason: null,
    };
    memorySessions.set(token, sessionRec);
    memUser.last_login_at = new Date().toISOString();

    const { password_hash, ...safeUser } = memUser;
    return { user: safeUser, token };
  }

  /**
   * Heartbeat enviado pelo navegador periodicamente (a cada 15-20 segundos).
   * Detecta se outra conexão foi aberta em outro local e encerra a sessão atual imediatamente.
   */
  static async validateAndHeartbeat(token: string): Promise<{
    user: UserRecord;
    activeSession: SessionRecord;
  }> {
    if (!token) throw new Error('Token de sessão não fornecido.');

    // 1. Tenta no PostgreSQL
    try {
      const res = await query(
        `SELECT s.*, 
                u.name as u_name, u.email as u_email, u.role as u_role, 
                u.subscription_status as u_sub_status, u.subscription_expires_at as u_sub_expires,
                u.is_blocked as u_blocked, u.trial_days as u_trial_days, u.created_at as u_created_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = $1
         LIMIT 1;`,
        [token]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];

        // Se a sessão foi invalidada por conexão em outro dispositivo:
        if (!row.is_active) {
          if (row.revoked_reason === 'concurrency_limit') {
            const err: any = new Error(
              'Sua conta foi conectada em outro dispositivo. Conexões simultâneas não são permitidas pela assinatura.'
            );
            err.code = 'CONCURRENT_LOGIN_DETECTED';
            throw err;
          }
          const err: any = new Error('Sessão encerrada.');
          err.code = 'SESSION_REVOKED';
          throw err;
        }

        if (row.u_blocked) {
          throw new Error('Acesso bloqueado pelo administrador.');
        }

        const userObj: UserRecord = {
          id: row.user_id,
          name: row.u_name,
          email: row.u_email,
          role: row.u_role,
          subscription_status: row.u_sub_status,
          subscription_expires_at: row.u_sub_expires,
          trial_days: row.u_trial_days,
          max_concurrent_sessions: 1,
          is_blocked: row.u_blocked,
          created_at: row.u_created_at,
          last_login_at: row.created_at,
        };

        SessionManager.checkSubscriptionStatus(userObj);

        // Atualiza timestamp do batimento da sessão
        await query(`UPDATE user_sessions SET last_heartbeat_at = NOW() WHERE id = $1;`, [row.id]);

        return {
          user: userObj,
          activeSession: {
            id: row.id,
            user_id: row.user_id,
            token: row.token,
            ip_address: row.ip_address,
            user_agent: row.user_agent,
            is_active: true,
            last_heartbeat_at: new Date().toISOString(),
            created_at: row.created_at,
            revoked_reason: null,
          },
        };
      }
    } catch (dbError: any) {
      if (dbError.code === 'CONCURRENT_LOGIN_DETECTED' || dbError.code === 'SESSION_REVOKED') {
        throw dbError;
      }
    }

    // 2. Fallback em memória
    const memSession = memorySessions.get(token);
    if (!memSession) {
      const err: any = new Error('Sessão inválida ou não encontrada.');
      err.code = 'SESSION_INVALID';
      throw err;
    }
    if (!memSession.is_active) {
      if (memSession.revoked_reason === 'concurrency_limit') {
        const err: any = new Error(
          'Sua conta foi conectada em outro dispositivo. Conexões simultâneas não são permitidas pela assinatura.'
        );
        err.code = 'CONCURRENT_LOGIN_DETECTED';
        throw err;
      }
      const err: any = new Error('Sessão encerrada.');
      err.code = 'SESSION_REVOKED';
      throw err;
    }

    let foundUser: UserRecord | null = null;
    for (const u of memoryUsers.values()) {
      if (u.id === memSession.user_id) {
        foundUser = u;
        break;
      }
    }

    if (!foundUser || foundUser.is_blocked) {
      throw new Error('Conta inacessível ou bloqueada.');
    }
    SessionManager.checkSubscriptionStatus(foundUser);
    memSession.last_heartbeat_at = new Date().toISOString();

    return { user: foundUser, activeSession: memSession };
  }

  /**
   * Encerra a sessão ativa (Logout).
   */
  static async logout(token: string): Promise<void> {
    try {
      await query(
        `UPDATE user_sessions SET is_active = FALSE, revoked_reason = 'user_logout' WHERE token = $1;`,
        [token]
      );
    } catch (e) {}

    const memSession = memorySessions.get(token);
    if (memSession) {
      memSession.is_active = false;
      memSession.revoked_reason = 'user_logout';
    }
  }

  /**
   * Validação rígida das regras de negócio de assinatura e trial.
   */
  static checkSubscriptionStatus(user: {
    subscription_status: string;
    subscription_expires_at: string | null;
    role: string;
  }): void {
    // Admin tem livre acesso irrestrito
    if (user.role === 'admin') return;

    if (user.subscription_status === 'inactive' || user.subscription_status === 'cancelled') {
      const err: any = new Error(
        'Assinatura inativa ou cancelada. Entre em contato com o suporte para reativar seu plano.'
      );
      err.code = 'SUBSCRIPTION_INACTIVE';
      throw err;
    }

    if (user.subscription_status === 'trial') {
      if (user.subscription_expires_at) {
        const expireDate = new Date(user.subscription_expires_at);
        if (expireDate.getTime() < Date.now()) {
          const err: any = new Error(
            'Seu período de demonstração gratuita (Free Trial) expirou. Adquira uma assinatura ativa para continuar utilizando o simulador.'
          );
          err.code = 'TRIAL_EXPIRED';
          throw err;
        }
      }
    }

    if (user.subscription_status === 'active' && user.subscription_expires_at) {
      const expireDate = new Date(user.subscription_expires_at);
      if (expireDate.getTime() < Date.now()) {
        const err: any = new Error(
          'Sua assinatura expirou. Renove sua assinatura para liberar o acesso ao simulador.'
        );
        err.code = 'SUBSCRIPTION_EXPIRED';
        throw err;
      }
    }
  }
}
