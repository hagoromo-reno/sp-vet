import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionManager } from '../server/auth/sessionManager';
import { hashPassword, verifyPassword } from '../server/auth/crypto';

test('Crypto: hashPassword e verifyPassword validam senhas com segurança', () => {
  const hash = hashPassword('minhasenha123');
  assert.ok(hash.includes(':'), 'O hash deve conter salt e chave derivados');
  assert.ok(verifyPassword('minhasenha123', hash), 'Senha correta deve ser aceita');
  assert.equal(verifyPassword('senhaerrada', hash), false, 'Senha incorreta deve ser rejeitada');
});

test('SessionManager: login bem sucedido e rejeição de credenciais incorretas', async () => {
  // Login admin
  const loginResult = await SessionManager.login(
    'admin@spvet.com',
    'admin123',
    '192.168.1.10',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  );

  assert.ok(loginResult.token);
  assert.equal(loginResult.user.email, 'admin@spvet.com');
  assert.equal(loginResult.user.role, 'admin');

  // Senha incorreta deve lançar erro
  await assert.rejects(
    async () => {
      await SessionManager.login('admin@spvet.com', 'senha_errada', '192.168.1.10', 'Browser');
    },
    { message: /Credenciais inválidas/ }
  );
});

test('Concorrência: NÃO permite conexão mútua / simultânea (SaaS)', async () => {
  // 1. Usuário conecta no Dispositivo A (ex: Notebook)
  const sessionA = await SessionManager.login(
    'demo@spvet.com',
    'demo123',
    '187.50.10.1',
    'Chrome on Windows'
  );
  assert.ok(sessionA.token);

  // Batimento do Dispositivo A deve estar saudável
  const heartbeatA1 = await SessionManager.validateAndHeartbeat(sessionA.token);
  assert.equal(heartbeatA1.user.email, 'demo@spvet.com');
  assert.equal(heartbeatA1.activeSession.is_active, true);

  // 2. Usuário conecta no Dispositivo B (ex: Tablet / Celular) com a mesma conta
  const sessionB = await SessionManager.login(
    'demo@spvet.com',
    'demo123',
    '201.80.20.2',
    'Safari on iPad'
  );
  assert.ok(sessionB.token);
  assert.notEqual(sessionA.token, sessionB.token);

  // 3. Batimento do Dispositivo B deve estar ativo e aprovado
  const heartbeatB = await SessionManager.validateAndHeartbeat(sessionB.token);
  assert.equal(heartbeatB.activeSession.is_active, true);

  // 4. Dispositivo A tenta novo batimento: DEVE SER RECUSADO por concorrência simultânea!
  await assert.rejects(
    async () => {
      await SessionManager.validateAndHeartbeat(sessionA.token);
    },
    (err: any) => {
      return err.code === 'CONCURRENT_LOGIN_DETECTED';
    }
  );
});

test('Assinatura & Trial: regras de bloqueio para planos inativos ou expirados', () => {
  // Usuário ativo
  assert.doesNotThrow(() => {
    SessionManager.checkSubscriptionStatus({
      subscription_status: 'active',
      subscription_expires_at: null,
      role: 'veterinarian',
    });
  });

  // Assinatura inativa deve ser bloqueada
  assert.throws(
    () => {
      SessionManager.checkSubscriptionStatus({
        subscription_status: 'inactive',
        subscription_expires_at: null,
        role: 'veterinarian',
      });
    },
    (err: any) => err.code === 'SUBSCRIPTION_INACTIVE'
  );

  // Free trial com data passada deve ser bloqueado
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);
  assert.throws(
    () => {
      SessionManager.checkSubscriptionStatus({
        subscription_status: 'trial',
        subscription_expires_at: pastDate.toISOString(),
        role: 'veterinarian',
      });
    },
    (err: any) => err.code === 'TRIAL_EXPIRED'
  );
});
