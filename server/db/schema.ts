import { pool, directPool, query } from './pool';
import { hashPassword } from '../auth/crypto';

export async function initDatabase(): Promise<boolean> {
  console.log('[DB] Inicializando conexão e tabelas no PostgreSQL/PgBouncer...');
  const runDdl = async (sql: string, params?: any[]) => {
    if (process.env.DIRECT_URL) {
      return directPool.query(sql, params);
    }
    return query(sql, params);
  };

  try {
    // 1. Extensions
    await runDdl(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // 2. Users table
    await runDdl(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'veterinarian',
        subscription_status VARCHAR(50) DEFAULT 'active',
        subscription_expires_at TIMESTAMPTZ,
        trial_days INT DEFAULT 7,
        max_concurrent_sessions INT DEFAULT 1,
        is_blocked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );
    `);

    // 2.1 Migrações seguras da tabela users (Licenciamento & Asaas)
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(50);`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10);`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_customer_id VARCHAR(100);`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_payment_id VARCHAR(100);`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT;`);
    await runDdl(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN DEFAULT FALSE;`);

    // 2.2 Tabela de Pedidos de Licença (Asaas Payments)
    await runDdl(`
      CREATE TABLE IF NOT EXISTS license_orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        asaas_customer_id VARCHAR(100),
        asaas_payment_id VARCHAR(100) UNIQUE,
        amount NUMERIC(10,2) NOT NULL DEFAULT 49.90,
        original_amount NUMERIC(10,2) NOT NULL DEFAULT 184.90,
        billing_type VARCHAR(50) DEFAULT 'PIX',
        status VARCHAR(50) DEFAULT 'PENDING',
        invoice_url TEXT,
        pix_qr_code_image TEXT,
        pix_copia_cola TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ,
        raw_asaas_data JSONB
      );
    `);
    await runDdl(`ALTER TABLE license_orders ALTER COLUMN user_id DROP NOT NULL;`);
    await runDdl(`ALTER TABLE license_orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);`);
    await runDdl(`ALTER TABLE license_orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);`);
    await runDdl(`ALTER TABLE license_orders ADD COLUMN IF NOT EXISTS customer_cpf VARCHAR(50);`);
    await runDdl(`ALTER TABLE license_orders ADD COLUMN IF NOT EXISTS session_token VARCHAR(255);`);
    await runDdl(`ALTER TABLE license_orders ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT FALSE;`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_license_orders_session_token ON license_orders(session_token);`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_license_orders_user ON license_orders(user_id);`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_license_orders_asaas ON license_orders(asaas_payment_id);`);

    // 3. User sessions table (for single session concurrency enforcement)
    await runDdl(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        ip_address VARCHAR(100),
        user_agent TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        revoked_reason VARCHAR(100)
      );
    `);

    // 4. Index for fast session lookup
    await runDdl(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);
    `);

    // 5. Professional perspectives and evaluations table
    await runDdl(`
      CREATE TABLE IF NOT EXISTS professional_perspectives (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        author_name VARCHAR(255),
        patient_id VARCHAR(100),
        patient_name VARCHAR(255),
        species VARCHAR(50),
        asa_score VARCHAR(20),
        conduct_summary TEXT,
        clinical_notes TEXT,
        telemetry_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 6. Simulation Reviews table (Revisão por Anestesiologista no Banco)
    await runDdl(`
      CREATE TABLE IF NOT EXISTS simulation_reviews (
        id VARCHAR(255) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        run_id VARCHAR(255) NOT NULL,
        snapshot_id VARCHAR(255) NOT NULL,
        reviewer VARCHAR(255) NOT NULL,
        qualification VARCHAR(255),
        verdict VARCHAR(50) NOT NULL,
        confidence VARCHAR(50) NOT NULL,
        expected_ranges JSONB,
        expected_narrative TEXT,
        rationale TEXT,
        related_event_id VARCHAR(255),
        expected_response_seconds NUMERIC,
        patient_id VARCHAR(100),
        patient_name VARCHAR(255),
        species VARCHAR(50),
        asa_status VARCHAR(20),
        run_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_sim_reviews_user ON simulation_reviews(user_id);`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_sim_reviews_run ON simulation_reviews(run_id);`);

    // 7. Patients table (Padrão do Sistema e Customizados por Veterinário)
    await runDdl(`
      CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR(100) PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        is_default BOOLEAN DEFAULT FALSE,
        name VARCHAR(255) NOT NULL,
        species VARCHAR(50) NOT NULL,
        breed VARCHAR(100),
        gender VARCHAR(20),
        age_years NUMERIC,
        age_months NUMERIC,
        weight_kg NUMERIC NOT NULL,
        asa VARCHAR(20) NOT NULL,
        scenario_title VARCHAR(255),
        scenario_description TEXT,
        clinical_history TEXT,
        surgical_procedure TEXT,
        profile_data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_patients_default ON patients(is_default);`);

    // 7.1 Procedure Logs table (Resumo do Procedimento e Atividades dos Alunos)
    await runDdl(`
      CREATE TABLE IF NOT EXISTS procedure_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        user_email VARCHAR(255) NOT NULL,
        student_name VARCHAR(255) NOT NULL,
        session_device_id VARCHAR(255),
        patient_id VARCHAR(100),
        patient_name VARCHAR(255),
        species VARCHAR(50),
        procedure_name VARCHAR(255),
        duration_seconds INT DEFAULT 0,
        outcome VARCHAR(50) NOT NULL DEFAULT 'ongoing',
        death_cause TEXT,
        final_hr INT,
        final_map INT,
        final_spo2 INT,
        final_etco2 NUMERIC,
        final_rr INT,
        administered_drugs JSONB DEFAULT '[]'::jsonb,
        vital_records JSONB DEFAULT '[]'::jsonb,
        events_summary JSONB DEFAULT '[]'::jsonb,
        clinical_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_procedure_logs_user ON procedure_logs(user_id);`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_procedure_logs_student ON procedure_logs(student_name);`);
    await runDdl(`CREATE INDEX IF NOT EXISTS idx_procedure_logs_created ON procedure_logs(created_at DESC);`);

    // 8. Seed Admin user if table is empty
    const checkAdmin = await query(`SELECT id FROM users WHERE email = 'admin@spvet.com' LIMIT 1;`);
    if (checkAdmin.rows.length === 0) {
      const adminPass = hashPassword('admin123');
      await query(`
        INSERT INTO users (name, email, password_hash, role, subscription_status, is_lifetime)
        VALUES ('Administrador SP-VET', 'admin@spvet.com', $1, 'admin', 'active', TRUE);
      `, [adminPass]);
      console.log('[DB] Usuário Admin padrão criado: admin@spvet.com (senha: admin123)');
    }

    // 8.1 Seed Student Class user (Conta compartilhada para alunos de turma)
    const checkStudent = await query(`SELECT id FROM users WHERE LOWER(email) = 'alunos@sopet.app' LIMIT 1;`);
    if (checkStudent.rows.length === 0) {
      const studentPass = hashPassword('melhoresalunos');
      await query(`
        INSERT INTO users (name, email, password_hash, role, subscription_status, max_concurrent_sessions, is_lifetime, trial_days, email_verified)
        VALUES ('Turma de Alunos', 'alunos@sopet.app', $1, 'student', 'active', 999, TRUE, 3650, TRUE);
      `, [studentPass]);
      console.log('[DB] Usuário de Alunos criado: alunos@sopet.app (senha: melhoresalunos, sessões simultâneas ilimitadas)');
    } else {
      await query(`
        UPDATE users 
        SET email_verified = TRUE, subscription_status = 'active', is_lifetime = TRUE, max_concurrent_sessions = 999, is_blocked = FALSE
        WHERE LOWER(email) = 'alunos@sopet.app' OR role = 'student';
      `);
    }

    // 9. Seed Demonstration / Trial user
    const checkDemo = await query(`SELECT id FROM users WHERE email = 'demo@spvet.com' LIMIT 1;`);
    if (checkDemo.rows.length === 0) {
      const demoPass = hashPassword('demo123');
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      await query(`
        INSERT INTO users (name, email, password_hash, role, subscription_status, subscription_expires_at, trial_days)
        VALUES ('Médico Veterinário (Trial)', 'demo@spvet.com', $1, 'veterinarian', 'trial', $2, 7);
      `, [demoPass, expires.toISOString()]);
      console.log('[DB] Usuário de Demonstração criado: demo@spvet.com (senha: demo123, 7 dias de trial)');
    }

    // 10. Seed Default Patients from scenarios
    const checkPatients = await query(`SELECT COUNT(*) as count FROM patients WHERE is_default = TRUE;`);
    if (Number(checkPatients.rows[0]?.count || 0) === 0) {
      const { PRESET_SCENARIOS } = await import('../../src/data/scenarios');
      for (const p of PRESET_SCENARIOS) {
        await query(`
          INSERT INTO patients (
            id, user_id, is_default, name, species, breed, gender, age_years, age_months, weight_kg,
            asa, scenario_title, scenario_description, clinical_history, surgical_procedure, profile_data
          ) VALUES ($1, NULL, TRUE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (id) DO NOTHING;
        `, [
          p.id,
          p.name,
          p.species,
          p.breed || '',
          p.gender || 'Não informado',
          p.ageYears ?? 0,
          p.ageMonths ?? 0,
          p.weightKg,
          p.asa,
          p.scenarioTitle,
          p.scenarioDescription,
          p.clinicalHistory || '',
          p.surgicalProcedure || '',
          JSON.stringify(p),
        ]);
      }
      console.log(`[DB] Pacientes padrão do sistema inseridos no banco: ${PRESET_SCENARIOS.length} casos.`);
    }

    console.log('[DB] Tabelas, índices e dados padrão verificados com sucesso no banco de dados.');
    return true;
  } catch (error: any) {
    console.warn('[DB] Aviso: Não foi possível conectar ao PostgreSQL/PgBouncer agora:', error?.message || error);
    console.warn('[DB] O servidor operará com fallback em memória caso o banco ainda esteja inicializando no Portainer.');
    return false;
  }
}
