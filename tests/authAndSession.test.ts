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

test('Revisões de Anestesiologistas: persistência no banco atrelada ao usuário e auditoria admin', async () => {
  const { AdminService } = await import('../server/admin/adminService');

  // 1. Veterinário submete parecer clínico da simulação
  const reviewVet1 = await AdminService.saveReview({
    userId: 'user-vet-1',
    userName: 'Dra. Maria (Anestesiologista)',
    userEmail: 'maria@spvet.com',
    runId: 'run-101',
    snapshotId: 'snap-5',
    reviewer: 'Dra. Maria',
    qualification: 'CRMV-SP 12345 / Residência Anestesiologia',
    verdict: 'plausible',
    confidence: 'high',
    expectedNarrative: 'Manutenção adequada do plano com Isoflurano 1.2% e infusão de Fentanil.',
    rationale: 'Evolução compatível com paciente canino saudável submetido a procedimento cirúrgico limpo.',
    patientId: 'patient-canine-1',
    patientName: 'Thor',
    species: 'canine',
    asaStatus: 'I',
  });

  assert.ok(reviewVet1.id);

  // 2. O próprio veterinário lista suas revisões
  const vetList = await AdminService.listReviews({ userId: 'user-vet-1', isAdmin: false });
  assert.ok(vetList.some((r) => r.id === reviewVet1.id));

  // 3. Outro veterinário NÃO deve ver a revisão privada da Dra. Maria
  const vet2List = await AdminService.listReviews({ userId: 'user-vet-2', isAdmin: false });
  assert.equal(vet2List.some((r) => r.id === reviewVet1.id), false);

  // 4. O Administrador tem visibilidade completa de todas as revisões
  const adminList = await AdminService.listReviews({ isAdmin: true });
  assert.ok(adminList.some((r) => r.id === reviewVet1.id));
});

test('Gestão de Pacientes: criação por veterinário, isolamento por conta e supervisão admin', async () => {
  const { AdminService } = await import('../server/admin/adminService');

  // 1. Vet cadastra paciente personalizado no banco
  const createdPatient = await AdminService.savePatient({
    id: 'custom_dog_breno',
    userId: 'user-vet-breno',
    name: 'Rex - Cardiopata Compensado',
    species: 'canine',
    breed: 'Boxer',
    weightKg: 28.5,
    asa: 'III',
    scenarioTitle: 'Caso Rex (Boxer ASA III)',
    profileData: {
      name: 'Rex',
      species: 'canine',
      weightKg: 28.5,
      asa: 'III',
    },
  });

  assert.equal(createdPatient.id, 'custom_dog_breno');

  // 2. O criador (Breno) lista os pacientes e vê seu caso personalizado
  const brenoList = await AdminService.listPatients({ userId: 'user-vet-breno', isAdmin: false });
  assert.ok(brenoList.some((p) => p.id === 'custom_dog_breno'));

  // 3. Outro veterinário (Carlos) NÃO vê o paciente customizado de Breno
  const carlosList = await AdminService.listPatients({ userId: 'user-vet-carlos', isAdmin: false });
  assert.equal(carlosList.some((p) => p.id === 'custom_dog_breno'), false);

  // 4. Administrador enxerga todos os pacientes de todos os veterinários
  const adminPatientList = await AdminService.listPatients({ isAdmin: true });
  assert.ok(adminPatientList.some((p) => p.id === 'custom_dog_breno'));
});

test('Segurança Acústica: AudioSynthesizer silencia o monitor antes da autenticação', async () => {
  const { AudioSynthesizer } = await import('../src/engine/audioSynthesizer');

  // Na tela de login (desautenticado): deve estar mudo
  AudioSynthesizer.setAuthenticated(false);
  assert.equal(AudioSynthesizer.getIsAuthenticated(), false);

  // Após autenticação: som liberado
  AudioSynthesizer.setAuthenticated(true);
  assert.equal(AudioSynthesizer.getIsAuthenticated(), true);

  // Logout volta a mutar
  AudioSynthesizer.setAuthenticated(false);
  assert.equal(AudioSynthesizer.getIsAuthenticated(), false);
});

test('Turma de Alunos: login compartilhado alunos@sopet.app permite múltiplas conexões simultâneas', async () => {
  // Aluno 1 conecta
  const session1 = await SessionManager.login(
    'alunos@sopet.app',
    'melhoresalunos',
    '10.0.0.1',
    'Chrome Device 1'
  );
  assert.ok(session1.token);
  assert.equal(session1.user.role, 'student');
  assert.notEqual(session1.user.role, 'admin', 'Alunos NÃO podem ter acesso de administrador');

  // Aluno 2 conecta simultaneamente na mesma conta
  const session2 = await SessionManager.login(
    'alunos@sopet.app',
    'melhoresalunos',
    '10.0.0.2',
    'Safari Device 2'
  );
  assert.ok(session2.token);
  assert.notEqual(session1.token, session2.token);

  // Aluno 3 conecta simultaneamente na mesma conta
  const session3 = await SessionManager.login(
    'alunos@sopet.app',
    'melhoresalunos',
    '10.0.0.3',
    'Firefox Device 3'
  );
  assert.ok(session3.token);

  // Ambas as 3 sessões devem conseguir fazer heartbeat sem que nenhuma seja derrubada
  const hb1 = await SessionManager.validateAndHeartbeat(session1.token);
  assert.equal(hb1.activeSession.is_active, true, 'Sessão 1 do Aluno deve permanecer ativa');

  const hb2 = await SessionManager.validateAndHeartbeat(session2.token);
  assert.equal(hb2.activeSession.is_active, true, 'Sessão 2 do Aluno deve permanecer ativa');

  const hb3 = await SessionManager.validateAndHeartbeat(session3.token);
  assert.equal(hb3.activeSession.is_active, true, 'Sessão 3 do Aluno deve permanecer ativa');
});

test('Procedure Logs: persistência de logs diferenciados por nome/codinome de aluno', async () => {
  const { AdminService } = await import('../server/admin/adminService');

  // Salva log para Mariana
  const logMariana = await AdminService.saveProcedureLog({
    userEmail: 'alunos@sopet.app',
    studentName: 'Mariana Silva',
    sessionDeviceId: 'dev_cookie_mariana_123',
    patientId: 'patient-1',
    patientName: 'Thor',
    species: 'canine',
    procedureName: 'Osh Eletiva',
    durationSeconds: 1200,
    outcome: 'finished',
    finalHr: 95,
    finalMap: 78,
    finalSpo2: 99,
    finalEtco2: 38,
    finalRr: 14,
    administeredDrugs: [{ name: 'Propofol', dosePerKg: 4 }],
  });
  assert.ok(logMariana.id);
  assert.equal(logMariana.student_name || logMariana.studentName, 'Mariana Silva');

  // Salva log para Pedro (com óbito)
  const logPedro = await AdminService.saveProcedureLog({
    userEmail: 'alunos@sopet.app',
    studentName: 'Pedro Aluno 02',
    sessionDeviceId: 'dev_cookie_pedro_456',
    patientId: 'patient-2',
    patientName: 'Mel',
    species: 'feline',
    procedureName: 'Enterotomia',
    durationSeconds: 850,
    outcome: 'death',
    deathCause: 'Fibrilação Ventricular refratária',
    finalHr: 0,
    finalMap: 0,
    finalSpo2: 0,
    finalEtco2: 0,
    finalRr: 0,
  });
  assert.ok(logPedro.id);
  assert.equal(logPedro.outcome, 'death');

  // Consulta por Mariana
  const marianaLogs = await AdminService.listProcedureLogs({
    studentName: 'Mariana',
    isAdmin: true,
  });
  assert.ok(marianaLogs.some((l: any) => (l.student_name || l.studentName).includes('Mariana')));
  assert.equal(marianaLogs.some((l: any) => (l.student_name || l.studentName).includes('Pedro')), false);

  // Admin lista todos os logs
  const allLogs = await AdminService.listProcedureLogs({
    isAdmin: true,
  });
  assert.ok(allLogs.length >= 2);
});

