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

    // 6. Seed Admin user if table is empty
    const checkAdmin = await query(`SELECT id FROM users WHERE email = 'admin@spvet.com' LIMIT 1;`);
    if (checkAdmin.rows.length === 0) {
      const adminPass = hashPassword('admin123');
      await query(`
        INSERT INTO users (name, email, password_hash, role, subscription_status)
        VALUES ('Administrador SP-VET', 'admin@spvet.com', $1, 'admin', 'active');
      `, [adminPass]);
      console.log('[DB] Usuário Admin padrão criado: admin@spvet.com (senha: admin123)');
    }

    // 7. Seed Demonstration / Trial user
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

    console.log('[DB] Tabelas e índices verificados com sucesso no banco de dados.');
    return true;
  } catch (error: any) {
    console.warn('[DB] Aviso: Não foi possível conectar ao PostgreSQL/PgBouncer agora:', error?.message || error);
    console.warn('[DB] O servidor operará com fallback em memória caso o banco ainda esteja inicializando no Portainer.');
    return false;
  }
}
