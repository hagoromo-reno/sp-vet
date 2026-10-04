import { query } from '../db/pool';
import { hashPassword, generateSessionToken } from '../auth/crypto';
import { emailService } from './emailService';
import { asaasService, AsaasPaymentResult } from './asaasService';
import { SessionManager, UserRecord } from '../auth/sessionManager';
import { randomUUID } from 'node:crypto';

export interface LicenseRegistrationInput {
  name?: string;
  email: string;
  passwordPlain?: string;
  cpf?: string;
  phone?: string;
}

export interface StoredOrder {
  id: string;
  userId: string;
  asaasCustomerId?: string;
  asaasPaymentId?: string;
  amount: number;
  status: string;
  billingType: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  bankSlipBarCode?: string;
  pixQrCodeImage?: string;
  pixCopiaCola?: string;
  createdAt: string;
  confirmedAt?: string;
}

// In-Memory Fallback Store (para desenvolvimento / quando Postgres estiver iniciando)
export const memoryOrders = new Map<string, StoredOrder>();
export const memoryPendingUsers = new Map<
  string,
  {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    cpf?: string;
    phone?: string;
    verificationCode: string;
    verificationExpires: Date;
    emailVerified: boolean;
    subscriptionStatus?: string;
    isLifetime?: boolean;
    asaasCustomerId?: string;
    asaasPaymentId?: string;
  }
>();

export class LicenseService {
  /**
   * 1. Inicia o cadastro do usuário para compra da licença promocional de R$ 49,90
   * Gera código de 6 dígitos e envia pelo AOL SMTP.
   */
  static async registerForLicense(
    input: LicenseRegistrationInput
  ): Promise<{ ok: boolean; email: string; code: string; message: string }> {
    const cleanEmail = (input.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('O e-mail é obrigatório para continuar.');
    }
    const cleanName = (input.name || cleanEmail.split('@')[0] || 'Veterinário').trim();
    const cleanPassword = (input.passwordPlain || 'Vet@123456').trim();

    if (cleanPassword.length < 6) {
      throw new Error('A senha deve possuir pelo menos 6 caracteres.');
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos
    const passwordHash = hashPassword(cleanPassword);

    // Tenta persistir no Postgres
    try {
      const existingUser = await query(`SELECT id, subscription_status, is_lifetime FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
      let userId: string;

      if (existingUser.rows.length > 0) {
        const u = existingUser.rows[0];
        if (u.is_lifetime || (u.subscription_status === 'active' && !u.subscription_expires_at)) {
          throw new Error('Este e-mail já possui uma Licença Vitalícia ativa no anest-vet! Faça login diretamente.');
        }
        // Atualiza código de verificação e senha (preservando phone/cpf se já existirem)
        await query(
          `UPDATE users 
           SET name = $1, password_hash = $2, phone = COALESCE($3, phone), cpf = COALESCE($4, cpf),
               verification_code = $5, verification_code_expires_at = $6, email_verified = FALSE,
               subscription_status = 'pending_payment', updated_at = NOW()
           WHERE id = $7;`,
          [cleanName, passwordHash, input.phone || null, input.cpf || null, verificationCode, verificationExpires, userId]
        );
      } else {
        userId = randomUUID();
        await query(
          `INSERT INTO users (
             id, name, email, password_hash, role, subscription_status,
             trial_days, email_verified, verification_code, verification_code_expires_at,
             phone, cpf, is_lifetime, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, 'veterinarian', 'pending_payment',
             0, FALSE, $5, $6, $7, $8, FALSE, NOW(), NOW()
           );`,
          [userId, cleanName, cleanEmail, passwordHash, verificationCode, verificationExpires, input.phone || null, input.cpf || null]
        );
      }

      console.log(`[LicenseService] Usuário registrado no banco: ${cleanEmail}. Código gerado: ${verificationCode}`);
    } catch (dbErr: any) {
      if (dbErr.message?.includes('já possui uma Licença Vitalícia')) throw dbErr;
      console.warn('[LicenseService] DB falhou, utilizando fallback em memória:', dbErr.message);

      // Fallback em memória
      const existingMem = memoryPendingUsers.get(cleanEmail);
      const userId = existingMem ? existingMem.id : randomUUID();
      memoryPendingUsers.set(cleanEmail, {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        cpf: input.cpf,
        phone: input.phone,
        verificationCode,
        verificationExpires,
        emailVerified: false,
      });
    }

    // Dispara e-mail de código via AOL SMTP
    const emailSent = await emailService.sendVerificationCode(cleanEmail, cleanName, verificationCode);

    return {
      ok: true,
      email: cleanEmail,
      code: verificationCode,
      message: emailSent
        ? 'Código de confirmação enviado para seu e-mail!'
        : 'Código gerado com sucesso.',
    };
  }

  /**
   * 2. Reenvia código de verificação
   */
  static async resendVerificationCode(email: string): Promise<{ ok: boolean; code: string; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpires = new Date(Date.now() + 30 * 60 * 1000);
    let userName = 'Colega Veterinário';

    try {
      const res = await query(`SELECT id, name FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
      if (res.rows.length > 0) {
        userName = res.rows[0].name;
        await query(
          `UPDATE users SET verification_code = $1, verification_code_expires_at = $2, updated_at = NOW() WHERE id = $3;`,
          [newCode, newExpires, res.rows[0].id]
        );
      }
    } catch (e) {
      const mem = memoryPendingUsers.get(cleanEmail);
      if (mem) {
        mem.verificationCode = newCode;
        mem.verificationExpires = newExpires;
        userName = mem.name;
      }
    }

    await emailService.sendVerificationCode(cleanEmail, userName, newCode);
    return { ok: true, code: newCode, message: 'Novo código de confirmação reenviado para o seu e-mail!' };
  }

  /**
   * 3. Confirma código do e-mail, gera a cobrança no Asaas de R$ 49,90 e autentica a sessão
   */
  static async verifyEmailAndCreateCharge(
    email: string,
    code: string,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    ok: boolean;
    user: any;
    token: string;
    payment: AsaasPaymentResult;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    let user: any = null;

    // 1. Valida no DB
    try {
      const dbRes = await query(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [cleanEmail]);
      if (dbRes.rows.length > 0) {
        const row = dbRes.rows[0];
        if (row.verification_code !== cleanCode) {
          throw new Error('Código de confirmação incorreto. Verifique o número enviado por e-mail.');
        }
        if (row.verification_code_expires_at && new Date(row.verification_code_expires_at).getTime() < Date.now()) {
          throw new Error('Código de confirmação expirado. Solicite um novo código.');
        }
        user = row;
      }
    } catch (e: any) {
      if (e.message?.includes('Código de confirmação')) throw e;
    }

    // Fallback em memória se não achou no DB
    if (!user) {
      const mem = memoryPendingUsers.get(cleanEmail);
      if (!mem) throw new Error('Cadastro não encontrado para este e-mail. Inicie o cadastro novamente.');
      if (mem.verificationCode !== cleanCode) throw new Error('Código de confirmação incorreto.');
      if (mem.verificationExpires.getTime() < Date.now()) throw new Error('Código de confirmação expirado.');
      user = {
        id: mem.id,
        name: mem.name,
        email: mem.email,
        phone: mem.phone,
        cpf: mem.cpf,
        role: 'veterinarian',
        subscription_status: 'pending_payment',
        is_lifetime: false,
      };
    }

    // 2. Cria cliente no Asaas
    const customerId = await asaasService.findOrCreateCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj: user.cpf,
      phone: user.phone,
    });

    // 3. Cria cobrança no Asaas para R$ 49,90
    const payment = await asaasService.createLifetimeLicensePayment(
      customerId,
      user.id,
      user.email,
      user.name
    );

    // 4. Salva no DB a atualização do usuário e a ordem de pagamento
    try {
      await query(
        `UPDATE users 
         SET email_verified = TRUE, asaas_customer_id = $1, asaas_payment_id = $2, asaas_invoice_url = $3, updated_at = NOW()
         WHERE id = $4;`,
        [customerId, payment.id, payment.invoiceUrl, user.id]
      );

      await query(
        `INSERT INTO license_orders (
           id, user_id, asaas_customer_id, asaas_payment_id, amount, billing_type, status,
           invoice_url, pix_qr_code_image, pix_copia_cola, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
         ) ON CONFLICT (asaas_payment_id) DO UPDATE 
           SET status = EXCLUDED.status, invoice_url = EXCLUDED.invoice_url;`,
        [
          randomUUID(),
          user.id,
          customerId,
          payment.id,
          payment.value,
          payment.billingType,
          payment.status,
          payment.invoiceUrl,
          payment.pixQrCodeImage || null,
          payment.pixCopiaCola || null,
        ]
      );
    } catch (e: any) {
      console.warn('[LicenseService] DB update warning:', e.message);
    }

    // Fallback de memória
    memoryOrders.set(payment.id, {
      id: randomUUID(),
      userId: user.id,
      asaasCustomerId: customerId,
      asaasPaymentId: payment.id,
      amount: payment.value,
      status: payment.status,
      billingType: payment.billingType,
      invoiceUrl: payment.invoiceUrl,
      pixQrCodeImage: payment.pixQrCodeImage,
      pixCopiaCola: payment.pixCopiaCola,
      createdAt: new Date().toISOString(),
    });

    // 5. Cria sessão ativa para que o usuário permaneça logado na tela de pagamento
    const token = generateSessionToken();
    try {
      await query(
        `INSERT INTO user_sessions (id, user_id, token, ip_address, user_agent, is_active, last_heartbeat_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW());`,
        [randomUUID(), user.id, token, ipAddress, userAgent]
      );
    } catch (e) {}

    // Garante que o SessionManager registre a sessão em memória caso necessário
    const safeUser: UserRecord = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'veterinarian',
      subscription_status: 'pending_payment',
      subscription_expires_at: null,
      trial_days: 0,
      max_concurrent_sessions: 1,
      is_blocked: false,
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };

    return {
      ok: true,
      user: safeUser,
      token,
      payment,
    };
  }

  /**
   * 4. Retorna o status do pedido e da licença do usuário
   */
  static async getOrderStatus(userId: string): Promise<any> {
    let order: any = null;
    let user: any = null;

    try {
      const userRes = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1;`, [userId]);
      if (userRes.rows.length > 0) user = userRes.rows[0];

      const orderRes = await query(
        `SELECT * FROM license_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1;`,
        [userId]
      );
      if (orderRes.rows.length > 0) order = orderRes.rows[0];
    } catch (e) {}

    if (!user) {
      for (const mem of memoryPendingUsers.values()) {
        if (mem.id === userId) {
          user = {
            id: mem.id,
            name: mem.name,
            email: mem.email,
            subscription_status: mem.subscriptionStatus || 'pending_payment',
            is_lifetime: mem.isLifetime ?? false,
            email_verified: mem.emailVerified,
          };
          break;
        }
      }
    }

    if (!order) {
      // Memory check
      for (const ord of memoryOrders.values()) {
        if (ord.userId === userId) {
          order = ord;
          break;
        }
      }
    }

    // Se a ordem ainda está pendente e o Asaas está configurado, checa em tempo real no Asaas
    if (order && (order.status === 'PENDING' || order.status === 'pending') && order.asaas_payment_id) {
      try {
        const asaasPay = await asaasService.getPayment(order.asaas_payment_id);
        if (asaasPay.status === 'RECEIVED' || asaasPay.status === 'CONFIRMED') {
          // Atualiza ativação
          await LicenseService.activateLicense(
            userId,
            order.asaas_payment_id,
            asaasPay.value || 49.90,
            order.invoice_url
          );
          order.status = 'CONFIRMED';
          if (user) user.subscription_status = 'active';
        }
      } catch (err: any) {
        console.warn('[LicenseService] Verificação em tempo real Asaas:', err.message);
      }
    }

    return {
      isLifetime: user?.is_lifetime || user?.subscription_status === 'active',
      subscriptionStatus: user?.subscription_status || 'pending_payment',
      emailVerified: user?.email_verified ?? true,
      order: order
        ? {
            id: order.id || order.asaas_payment_id,
            paymentId: order.asaas_payment_id,
            amount: order.amount || 49.90,
            status: order.status,
            invoiceUrl: order.invoice_url,
            bankSlipUrl: order.bank_slip_url || order.bankSlipUrl,
            bankSlipBarCode: order.bank_slip_barcode || order.bankSlipBarCode,
            pixQrCodeImage: order.pix_qr_code_image,
            pixCopiaCola: order.pix_copia_cola,
            billingType: order.billing_type,
            createdAt: order.created_at,
          }
        : null,
    };
  }

  /**
   * 4.5 Processa Pagamento Direto com Cartão de Crédito
   */
  static async payOrderWithCreditCard(userId: string, card: any): Promise<any> {
    const statusData = await LicenseService.getOrderStatus(userId);
    if (!statusData.order || !statusData.order.paymentId) {
      throw new Error('Nenhuma cobrança pendente localizada para esta conta.');
    }

    let userEmail = '';
    try {
      const uRes = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1;`, [userId]);
      if (uRes.rows.length > 0) userEmail = uRes.rows[0].email;
    } catch (e) {}

    const result = await asaasService.payWithCreditCard(
      statusData.order.paymentId,
      card,
      userEmail || 'cliente@anest-vet.com'
    );

    if (result.status === 'CONFIRMED' || result.status === 'RECEIVED') {
      await LicenseService.activateLicense(
        userId,
        statusData.order.paymentId,
        statusData.order.amount || 49.90,
        statusData.order.invoiceUrl
      );
    }

    return result;
  }

  /**
   * 5. Processa Webhooks recebidos do Banco Asaas
   */
  static async handleAsaasWebhook(
    event: string,
    payment: any,
    webhookToken?: string
  ): Promise<{ ok: boolean; message: string }> {
    console.log(`[LicenseService] Webhook Asaas recebido: Evento=${event}, PaymentId=${payment?.id}`);

    // Valida token do webhook
    if (!asaasService.validateWebhookToken(webhookToken)) {
      console.error('[LicenseService] Webhook Rejeitado: Token de autenticação inválido.');
      throw new Error('Token de autenticação do Webhook inválido.');
    }

    // Eventos de confirmação de pagamento
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const paymentId = payment.id;
      const externalUserId = payment.externalReference;
      const customerEmail = payment.customerEmail || payment.email;

      let targetUserId = externalUserId;

      // Se não veio no externalReference, localiza pelo ID da cobrança
      if (!targetUserId && paymentId) {
        try {
          const ordRes = await query(`SELECT user_id FROM license_orders WHERE asaas_payment_id = $1 LIMIT 1;`, [paymentId]);
          if (ordRes.rows.length > 0) targetUserId = ordRes.rows[0].user_id;
        } catch (e) {}
      }

      // Se ainda não encontrou, busca pelo e-mail
      if (!targetUserId && customerEmail) {
        try {
          const uRes = await query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1;`, [customerEmail.trim().toLowerCase()]);
          if (uRes.rows.length > 0) targetUserId = uRes.rows[0].id;
        } catch (e) {}
      }

      if (!targetUserId) {
        console.warn(`[LicenseService] Usuário correspondente ao pagamento ${paymentId} não foi encontrado.`);
        return { ok: false, message: 'Usuário não localizado para este pagamento.' };
      }

      // Ativa a licença vitalícia e dispara o e-mail de confirmação
      await LicenseService.activateLicense(
        targetUserId,
        paymentId,
        payment.value || 49.90,
        payment.invoiceUrl
      );

      return { ok: true, message: 'Licença vitalícia ativada com sucesso e e-mail enviado!' };
    }

    return { ok: true, message: `Evento ${event} recebido sem necessidade de ativação imediata.` };
  }

  /**
   * 6. Ativação efetiva da licença e disparo de e-mail de parabéns
   */
  static async activateLicense(
    userId: string,
    paymentId: string,
    amount: number,
    invoiceUrl?: string
  ): Promise<void> {
    let userName = 'Colega Veterinário';
    let userEmail = '';

    try {
      // Atualiza usuário no Postgres
      const userRes = await query(
        `UPDATE users 
         SET subscription_status = 'active',
             subscription_expires_at = NULL,
             is_lifetime = TRUE,
             email_verified = TRUE,
             updated_at = NOW()
         WHERE id = $1
         RETURNING name, email;`,
        [userId]
      );

      if (userRes.rows.length > 0) {
        userName = userRes.rows[0].name;
        userEmail = userRes.rows[0].email;
      }

      // Atualiza a ordem
      await query(
        `UPDATE license_orders 
         SET status = 'CONFIRMED', confirmed_at = NOW()
         WHERE asaas_payment_id = $1 OR user_id = $2;`,
        [paymentId, userId]
      );
    } catch (e: any) {
      console.warn('[LicenseService] Ativação Postgres aviso:', e.message);
    }

    // Atualiza fallback em memória se aplicável
    for (const mem of memoryPendingUsers.values()) {
      if (mem.id === userId) {
        mem.subscriptionStatus = 'active';
        mem.isLifetime = true;
        mem.emailVerified = true;
        userName = mem.name;
        userEmail = mem.email;
        break;
      }
    }

    for (const ord of memoryOrders.values()) {
      if (ord.userId === userId || ord.asaasPaymentId === paymentId) {
        ord.status = 'CONFIRMED';
        ord.confirmedAt = new Date().toISOString();
      }
    }

    console.log(`[LicenseService] 🏆 LICENÇA VITALÍCIA ATIVADA com sucesso para usuário: ${userEmail || userId}`);

    // Dispara o e-mail de confirmação e recibo via AOL SMTP
    if (userEmail) {
      await emailService.sendPaymentConfirmationEmail(userEmail, userName, {
        paymentId,
        amount,
        invoiceUrl,
        paidAt: new Date().toISOString(),
      });
    }
  }
}
