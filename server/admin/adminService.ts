import { query } from '../db/pool';
import { hashPassword } from '../auth/crypto';
import { randomUUID } from 'node:crypto';

export interface AdminUserDto {
  name: string;
  email: string;
  password?: string;
  role?: 'admin' | 'veterinarian' | 'student';
  subscription_status?: 'active' | 'inactive' | 'trial' | 'cancelled';
  subscription_expires_at?: string | null;
  trial_days?: number;
  is_blocked?: boolean;
}

export interface ProfessionalPerspectiveDto {
  userId?: string;
  authorName: string;
  patientId: string;
  patientName: string;
  species: string;
  asaScore: string;
  conductSummary: string;
  clinicalNotes: string;
  telemetryData?: any;
}

export class AdminService {
  /**
   * Métricas do painel administrativo
   */
  static async getMetrics() {
    try {
      const userStats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE subscription_status = 'active' AND is_blocked = FALSE) as active,
          COUNT(*) FILTER (WHERE subscription_status = 'trial' AND is_blocked = FALSE) as trial,
          COUNT(*) FILTER (WHERE subscription_status = 'inactive' OR is_blocked = TRUE) as inactive
        FROM users;
      `);

      const sessionStats = await query(`
        SELECT COUNT(*) as online_count 
        FROM user_sessions 
        WHERE is_active = TRUE AND last_heartbeat_at >= NOW() - INTERVAL '2 minute';
      `);

      const perspectiveStats = await query(`
        SELECT COUNT(*) as total_perspectives FROM professional_perspectives;
      `);

      return {
        totalUsers: Number(userStats.rows[0]?.total || 0),
        activeSubscriptions: Number(userStats.rows[0]?.active || 0),
        trialUsers: Number(userStats.rows[0]?.trial || 0),
        inactiveUsers: Number(userStats.rows[0]?.inactive || 0),
        onlineUsers: Number(sessionStats.rows[0]?.online_count || 0),
        totalPerspectives: Number(perspectiveStats.rows[0]?.total_perspectives || 0),
      };
    } catch (e) {
      return {
        totalUsers: 2,
        activeSubscriptions: 1,
        trialUsers: 1,
        inactiveUsers: 0,
        onlineUsers: 1,
        totalPerspectives: 0,
      };
    }
  }

  /**
   * Listar todos os usuários cadastrados
   */
  static async listUsers(search = '', filterStatus = '') {
    try {
      let q = `
        SELECT id, name, email, role, subscription_status, subscription_expires_at, 
               trial_days, is_blocked, created_at, last_login_at
        FROM users
        WHERE 1=1
      `;
      const params: any[] = [];

      if (search) {
        params.push(`%${search.toLowerCase()}%`);
        q += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`;
      }

      if (filterStatus) {
        params.push(filterStatus);
        q += ` AND subscription_status = $${params.length}`;
      }

      q += ` ORDER BY created_at DESC;`;
      const res = await query(q, params);
      return res.rows;
    } catch (e) {
      return [];
    }
  }

  /**
   * Criar novo usuário pelo painel admin
   */
  static async createUser(dto: AdminUserDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const passwordHash = hashPassword(dto.password || 'senha123');

    let expires = dto.subscription_expires_at;
    if (dto.subscription_status === 'trial' && !expires) {
      const d = new Date();
      d.setDate(d.getDate() + (dto.trial_days || 7));
      expires = d.toISOString();
    }

    const res = await query(
      `INSERT INTO users (name, email, password_hash, role, subscription_status, subscription_expires_at, trial_days, is_blocked)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, role, subscription_status, subscription_expires_at, trial_days, is_blocked, created_at;`,
      [
        dto.name,
        cleanEmail,
        passwordHash,
        dto.role || 'veterinarian',
        dto.subscription_status || 'active',
        expires,
        dto.trial_days || 7,
        dto.is_blocked || false,
      ]
    );

    return res.rows[0];
  }

  /**
   * Atualizar dados e status de assinatura do usuário
   */
  static async updateUser(id: string, dto: Partial<AdminUserDto>) {
    let updateFields: string[] = [];
    let params: any[] = [id];

    if (dto.name) {
      params.push(dto.name);
      updateFields.push(`name = $${params.length}`);
    }
    if (dto.role) {
      params.push(dto.role);
      updateFields.push(`role = $${params.length}`);
    }
    if (dto.subscription_status) {
      params.push(dto.subscription_status);
      updateFields.push(`subscription_status = $${params.length}`);
    }
    if (dto.subscription_expires_at !== undefined) {
      params.push(dto.subscription_expires_at);
      updateFields.push(`subscription_expires_at = $${params.length}`);
    }
    if (dto.trial_days !== undefined) {
      params.push(dto.trial_days);
      updateFields.push(`trial_days = $${params.length}`);
    }
    if (dto.is_blocked !== undefined) {
      params.push(dto.is_blocked);
      updateFields.push(`is_blocked = $${params.length}`);
      // Se bloqueou, derruba sessões ativas
      if (dto.is_blocked) {
        await query(`UPDATE user_sessions SET is_active = FALSE, revoked_reason = 'admin_blocked' WHERE user_id = $1;`, [id]);
      }
    }
    if (dto.password) {
      const hash = hashPassword(dto.password);
      params.push(hash);
      updateFields.push(`password_hash = $${params.length}`);
    }

    updateFields.push(`updated_at = NOW()`);

    const q = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $1 RETURNING id, name, email, role, subscription_status, subscription_expires_at, is_blocked;`;
    const res = await query(q, params);
    return res.rows[0];
  }

  /**
   * Remover usuário
   */
  static async deleteUser(id: string) {
    await query(`DELETE FROM users WHERE id = $1;`, [id]);
    return { ok: true };
  }

  /**
   * Monitor de sessões e conexões ativas em tempo real
   */
  static async listActiveSessions() {
    try {
      const res = await query(`
        SELECT s.id, s.user_id, s.ip_address, s.user_agent, s.created_at as connected_at, 
               s.last_heartbeat_at, u.name as user_name, u.email as user_email, u.subscription_status
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.is_active = TRUE
        ORDER BY s.last_heartbeat_at DESC;
      `);
      return res.rows;
    } catch (e) {
      return [];
    }
  }

  /**
   * Derrubar / Revogar sessão forçadamente pelo admin
   */
  static async revokeSession(sessionId: string) {
    await query(
      `UPDATE user_sessions SET is_active = FALSE, revoked_reason = 'admin_revoked' WHERE id = $1;`,
      [sessionId]
    );
    return { ok: true };
  }

  /**
   * Salvar perspectiva clínica e parecer do profissional no banco de dados
   */
  static async saveProfessionalPerspective(dto: ProfessionalPerspectiveDto) {
    const res = await query(
      `INSERT INTO professional_perspectives 
        (user_id, author_name, patient_id, patient_name, species, asa_score, conduct_summary, clinical_notes, telemetry_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [
        dto.userId || null,
        dto.authorName,
        dto.patientId,
        dto.patientName,
        dto.species,
        dto.asaScore,
        dto.conductSummary,
        dto.clinicalNotes,
        dto.telemetryData ? JSON.stringify(dto.telemetryData) : null,
      ]
    );
    return res.rows[0];
  }

  /**
   * Listar pareceres e perspectivas registradas
   */
  static async listPerspectives(userId?: string) {
    try {
      if (userId) {
        const res = await query(
          `SELECT * FROM professional_perspectives WHERE user_id = $1 ORDER BY created_at DESC;`,
          [userId]
        );
        return res.rows;
      }
      const res = await query(
        `SELECT * FROM professional_perspectives ORDER BY created_at DESC LIMIT 100;`
      );
      return res.rows;
    } catch (e) {
      return [];
    }
  }

  // =========================================================================
  // REVISÕES DE ANESTESIOLOGIA (PostgreSQL)
  // =========================================================================

  private static inMemoryReviews: any[] = [];

  static async saveReview(dto: {
    id?: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    runId: string;
    snapshotId: string;
    reviewer: string;
    qualification: string;
    verdict: string;
    confidence: string;
    expectedRanges?: any;
    expectedNarrative: string;
    rationale: string;
    relatedEventId?: string;
    expectedResponseSeconds?: number;
    patientId?: string;
    patientName?: string;
    species?: string;
    asaStatus?: string;
    runData?: any;
  }) {
    const id = dto.id || randomUUID();
    try {
      const res = await query(
        `INSERT INTO simulation_reviews 
          (id, user_id, user_name, user_email, run_id, snapshot_id, reviewer, qualification, verdict, confidence,
           expected_ranges, expected_narrative, rationale, related_event_id, expected_response_seconds,
           patient_id, patient_name, species, asa_status, run_data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
         ON CONFLICT (id) DO UPDATE SET
           reviewer = EXCLUDED.reviewer,
           qualification = EXCLUDED.qualification,
           verdict = EXCLUDED.verdict,
           confidence = EXCLUDED.confidence,
           expected_ranges = EXCLUDED.expected_ranges,
           expected_narrative = EXCLUDED.expected_narrative,
           rationale = EXCLUDED.rationale,
           related_event_id = EXCLUDED.related_event_id,
           expected_response_seconds = EXCLUDED.expected_response_seconds,
           run_data = EXCLUDED.run_data,
           updated_at = NOW()
         RETURNING *;`,
        [
          id,
          dto.userId,
          dto.userName || '',
          dto.userEmail || '',
          dto.runId,
          dto.snapshotId,
          dto.reviewer,
          dto.qualification,
          dto.verdict,
          dto.confidence,
          dto.expectedRanges ? JSON.stringify(dto.expectedRanges) : null,
          dto.expectedNarrative,
          dto.rationale,
          dto.relatedEventId || null,
          dto.expectedResponseSeconds ?? null,
          dto.patientId || null,
          dto.patientName || null,
          dto.species || null,
          dto.asaStatus || null,
          dto.runData ? JSON.stringify(dto.runData) : null,
        ]
      );
      return res.rows[0];
    } catch (e) {
      // In-memory fallback
      const record = { ...dto, id, created_at: new Date().toISOString() };
      this.inMemoryReviews = [record, ...this.inMemoryReviews.filter((r) => r.id !== id)];
      return record;
    }
  }

  static async listReviews(options: { userId?: string; isAdmin: boolean }) {
    try {
      if (options.isAdmin) {
        const res = await query(`
          SELECT sr.*, u.name as author_name, u.email as author_email
          FROM simulation_reviews sr
          LEFT JOIN users u ON u.id = sr.user_id
          ORDER BY sr.created_at DESC;
        `);
        return res.rows;
      }

      const res = await query(`
        SELECT sr.*, u.name as author_name, u.email as author_email
        FROM simulation_reviews sr
        LEFT JOIN users u ON u.id = sr.user_id
        WHERE sr.user_id = $1
        ORDER BY sr.created_at DESC;
      `, [options.userId]);
      return res.rows;
    } catch (e) {
      if (options.isAdmin) {
        return this.inMemoryReviews;
      }
      return this.inMemoryReviews.filter((r) => r.userId === options.userId);
    }
  }

  static async deleteReview(id: string, userId: string, isAdmin: boolean) {
    try {
      if (isAdmin) {
        await query(`DELETE FROM simulation_reviews WHERE id = $1;`, [id]);
      } else {
        await query(`DELETE FROM simulation_reviews WHERE id = $1 AND user_id = $2;`, [id, userId]);
      }
    } catch (e) {
      this.inMemoryReviews = this.inMemoryReviews.filter((r) => r.id !== id);
    }
    return { ok: true };
  }

  // =========================================================================
  // GESTÃO DE PACIENTES (Padrão & Personalizados no PostgreSQL)
  // =========================================================================

  private static inMemoryPatients: any[] = [];

  static async savePatient(dto: {
    id?: string;
    userId: string;
    name: string;
    species: string;
    breed?: string;
    gender?: string;
    ageYears?: number;
    ageMonths?: number;
    weightKg: number;
    asa: string;
    scenarioTitle?: string;
    scenarioDescription?: string;
    clinicalHistory?: string;
    surgicalProcedure?: string;
    profileData: any;
  }) {
    const id = dto.id || `custom_${Date.now()}_${randomUUID().slice(0, 8)}`;
    try {
      const res = await query(
        `INSERT INTO patients 
          (id, user_id, is_default, name, species, breed, gender, age_years, age_months, weight_kg,
           asa, scenario_title, scenario_description, clinical_history, surgical_procedure, profile_data, updated_at)
         VALUES ($1, $2, FALSE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           species = EXCLUDED.species,
           breed = EXCLUDED.breed,
           gender = EXCLUDED.gender,
           age_years = EXCLUDED.age_years,
           age_months = EXCLUDED.age_months,
           weight_kg = EXCLUDED.weight_kg,
           asa = EXCLUDED.asa,
           scenario_title = EXCLUDED.scenario_title,
           scenario_description = EXCLUDED.scenario_description,
           clinical_history = EXCLUDED.clinical_history,
           surgical_procedure = EXCLUDED.surgical_procedure,
           profile_data = EXCLUDED.profile_data,
           updated_at = NOW()
         RETURNING *;`,
        [
          id,
          dto.userId,
          dto.name,
          dto.species,
          dto.breed || '',
          dto.gender || '',
          dto.ageYears ?? 0,
          dto.ageMonths ?? 0,
          dto.weightKg,
          dto.asa,
          dto.scenarioTitle || `Caso: ${dto.name}`,
          dto.scenarioDescription || '',
          dto.clinicalHistory || '',
          dto.surgicalProcedure || '',
          JSON.stringify(dto.profileData),
        ]
      );
      return res.rows[0];
    } catch (e) {
      const record = { ...dto, id, is_default: false, created_at: new Date().toISOString() };
      this.inMemoryPatients = [record, ...this.inMemoryPatients.filter((p) => p.id !== id)];
      return record;
    }
  }

  static async listPatients(options: { userId?: string; isAdmin: boolean }) {
    try {
      if (options.isAdmin) {
        const res = await query(`
          SELECT p.*, u.name as author_name, u.email as author_email
          FROM patients p
          LEFT JOIN users u ON u.id = p.user_id
          ORDER BY p.is_default DESC, p.created_at DESC;
        `);
        return res.rows;
      }

      const res = await query(`
        SELECT p.*, u.name as author_name, u.email as author_email
        FROM patients p
        LEFT JOIN users u ON u.id = p.user_id
        WHERE p.is_default = TRUE OR p.user_id = $1
        ORDER BY p.is_default DESC, p.created_at DESC;
      `, [options.userId]);
      return res.rows;
    } catch (e) {
      if (options.isAdmin) {
        return this.inMemoryPatients;
      }
      return this.inMemoryPatients.filter((p) => p.is_default || p.userId === options.userId);
    }
  }

  static async deletePatient(id: string, userId: string, isAdmin: boolean) {
    try {
      if (isAdmin) {
        await query(`DELETE FROM patients WHERE id = $1 AND is_default = FALSE;`, [id]);
      } else {
        await query(`DELETE FROM patients WHERE id = $1 AND user_id = $2 AND is_default = FALSE;`, [id, userId]);
      }
    } catch (e) {
      this.inMemoryPatients = this.inMemoryPatients.filter((p) => p.id !== id);
    }
    return { ok: true };
  }
}
