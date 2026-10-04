import nodemailer, { type Transporter, type SendMailOptions } from 'nodemailer';

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailServiceConfig;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.aol.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : true,
      user: process.env.SMTP_USER || 'arbor.br@aol.com',
      pass: process.env.SMTP_PASS || 'doohwgckvsnxglhw',
      from: process.env.SMTP_FROM || '"ANEST-VET Simulador Veterinário" <arbor.br@aol.com>',
    };

    this.initTransporter();
  }

  private createTransporter(port: number, secure: boolean): Transporter {
    return nodemailer.createTransport({
      host: this.config.host,
      port,
      secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
      connectionTimeout: port === 465 ? 3500 : 7000,
      greetingTimeout: 6000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  private initTransporter() {
    try {
      this.transporter = this.createTransporter(this.config.port, this.config.secure);
      console.log(`[EmailService] Configurado para ${this.config.user} via ${this.config.host}:${this.config.port}`);
    } catch (err: any) {
      console.error('[EmailService] Erro ao instanciar transportador de e-mail:', err.message);
    }
  }

  /**
   * Envia e-mail com fallback automático de porta 465 -> 587 caso haja bloqueio de rede
   */
  private async sendMailWithFallback(mailOptions: SendMailOptions): Promise<boolean> {
    if (!this.transporter) this.initTransporter();

    // 1. Tenta envio principal (porta configurada)
    try {
      if (this.transporter) {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`[EmailService] E-mail enviado com sucesso (porta ${this.config.port}): ${info.messageId}`);
        return true;
      }
    } catch (err: any) {
      console.warn(`[EmailService] Tentativa na porta ${this.config.port} falhou: ${err.message}. Tentando porta alternativa 587...`);
    }

    // 2. Fallback na porta 587 (STARTTLS) caso a porta principal tenha sido 465
    try {
      const fallbackTransporter = this.createTransporter(587, false);
      const info = await fallbackTransporter.sendMail(mailOptions);
      console.log(`[EmailService] E-mail enviado com sucesso via porta alternativa 587: ${info.messageId}`);
      // Salva transportador de sucesso e fixa porta 587 permanentemente
      this.transporter = fallbackTransporter;
      this.config.port = 587;
      this.config.secure = false;
      return true;
    } catch (fallbackErr: any) {
      console.error(`[EmailService] Falha no envio em ambas as portas (465 e 587):`, fallbackErr.message);
      return false;
    }
  }

  /**
   * Envia o código de 6 dígitos para confirmação de e-mail antes da cobrança.
   */
  async sendVerificationCode(to: string, name: string, code: string): Promise<boolean> {
    if (!this.transporter) this.initTransporter();
    const cleanTo = to.trim();

    const subject = `Código de Confirmação: ${code} - anest-vet Licença Vitalícia`;
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0b0c12; color: #e4e4e7; margin: 0; padding: 24px; }
    .container { max-width: 580px; margin: 0 auto; background-color: #12131d; border: 1px solid #27293d; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #059669, #0d9488); padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 1px; font-weight: 800; text-transform: uppercase; }
    .header p { margin: 6px 0 0; color: #d1fae5; font-size: 13px; font-weight: 500; }
    .body { padding: 32px 24px; line-height: 1.6; }
    .greeting { font-size: 17px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }
    .text { font-size: 14px; color: #a1a1aa; margin-bottom: 24px; }
    .code-box { background-color: #090a10; border: 2px dashed #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
    .code-label { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #10b981; font-weight: 700; margin-bottom: 8px; }
    .code-value { font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #ffffff; font-family: 'Courier New', Courier, monospace; }
    .notice { font-size: 12px; color: #71717a; border-top: 1px solid #222436; padding-top: 18px; margin-top: 24px; }
    .footer { background-color: #090a0f; padding: 18px 24px; text-align: center; font-size: 11px; color: #52525b; border-top: 1px solid #1a1c2b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ANEST-VET Simulador Veterinário</h1>
      <p>Simulador Fisiológico Veterinário Avançado</p>
    </div>
    <div class="body">
      <div class="greeting">Olá, ${name || 'Colega Veterinário'}!</div>
      <p class="text">
        Você iniciou a ativação da sua <strong>Licença Vitalícia Promocional</strong> (de R$ 184,90 por <strong>R$ 49,90</strong>).
        Para garantir a segurança do seu acesso e liberar a emissão do pagamento via Asaas, confirme o seu e-mail utilizando o código de verificação abaixo:
      </p>

      <div class="code-box">
        <div class="code-label">Seu Código de Confirmação</div>
        <div class="code-value">${code}</div>
      </div>

      <p class="text" style="font-size: 13px;">
        Insira este código na tela de compra do simulador para prosseguir para o pagamento via Cartão, PIX ou Boleto. Este código expira em 30 minutos.
      </p>

      <div class="notice">
        Se você não solicitou este cadastro, ignore este e-mail com segurança.
      </div>
    </div>
    <div class="footer">
      anest-vet · Gestão e Licenciamento: arbor.br@aol.com · anest.sopet.app
    </div>
  </div>
</body>
</html>
    `;

    return await this.sendMailWithFallback({
      from: this.config.from,
      to: cleanTo,
      subject,
      html,
    });
  }

  /**
   * Envia o e-mail oficial de confirmação de pagamento e ativação da Licença Vitalícia.
   */
  async sendPaymentConfirmationEmail(
    to: string,
    name: string,
    paymentDetails: {
      paymentId: string;
      amount: number;
      invoiceUrl?: string;
      paidAt?: string;
    }
  ): Promise<boolean> {
    if (!this.transporter) this.initTransporter();
    const cleanTo = to.trim();

    const formattedAmount = Number(paymentDetails.amount || 49.9).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const formattedDate = paymentDetails.paidAt
      ? new Date(paymentDetails.paidAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : new Date().toLocaleDateString('pt-BR');

    const subject = `🎉 Pagamento Confirmado! Sua Licença Vitalícia anest-vet está Ativa!`;
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #08090d; color: #e4e4e7; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #11131c; border: 1px solid #10b981; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(16, 185, 129, 0.15); }
    .badge-bar { background-color: #064e3b; color: #6ee7b7; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; text-align: center; padding: 8px 16px; }
    .header { background: linear-gradient(135deg, #047857, #065f46); padding: 36px 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; letter-spacing: 0.5px; }
    .header p { margin: 8px 0 0; color: #a7f3d0; font-size: 14px; font-weight: 500; }
    .body { padding: 32px 28px; line-height: 1.6; }
    .highlight-card { background-color: #0c0d15; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1c1e2d; font-size: 13px; }
    .receipt-row:last-child { border-bottom: none; font-weight: 700; font-size: 15px; color: #10b981; padding-top: 12px; }
    .receipt-label { color: #9ca3af; }
    .receipt-val { color: #f3f4f6; }
    .btn { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #000000 !important; font-weight: 800; text-decoration: none; padding: 16px 36px; border-radius: 10px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-top: 20px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); text-align: center; }
    .features-list { list-style: none; padding: 0; margin: 20px 0; }
    .features-list li { padding: 6px 0; font-size: 13px; color: #d1d5db; }
    .features-list li::before { content: "✓ "; color: #10b981; font-weight: bold; }
    .footer { background-color: #08090e; padding: 22px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #181926; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge-bar">Efetivação de Licença Vitalícia · Banco Asaas</div>
    <div class="header">
      <h1>Parabéns, ${name || 'Doutor(a)'}!</h1>
      <p>Seu acesso definitivo ao anest-vet foi liberado com sucesso</p>
    </div>
    <div class="body">
      <p style="font-size: 15px; color: #f4f4f5; margin-top: 0;">
        Confirmamos com sucesso a compensação do seu pagamento através do <strong>Banco Asaas</strong>. A sua conta no anest-vet agora possui <strong>Acesso Vitalício Completo</strong> sem cobranças futuras ou mensalidades!
      </p>

      <div class="highlight-card">
        <div style="font-size: 12px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Comprovante de Licença</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Produto:</td>
            <td style="padding: 6px 0; text-align: right; color: #ffffff; font-weight: 600;">Licença Vitalícia anest-vet (Anestesia & UTI)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Promoção:</td>
            <td style="padding: 6px 0; text-align: right; color: #a1a1aa;"><strike>R$ 184,90</strike> (Desconto Exclusivo)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Valor Pago:</td>
            <td style="padding: 6px 0; text-align: right; color: #10b981; font-weight: 800; font-size: 15px;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Data de Efetivação:</td>
            <td style="padding: 6px 0; text-align: right; color: #ffffff;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">ID Transação Asaas:</td>
            <td style="padding: 6px 0; text-align: right; color: #a1a1aa; font-family: monospace;">${paymentDetails.paymentId}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #9ca3af;">Validade:</td>
            <td style="padding: 6px 0; text-align: right; color: #10b981; font-weight: 700;">VITALÍCIA (Sem expiração)</td>
          </tr>
        </table>
      </div>

      <div style="font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 8px;">Recursos Liberados em sua Conta:</div>
      <ul class="features-list">
        <li>Acesso irrestrito a todos os modelos fisiológicos multicompartimentais</li>
        <li>Simulador de monitorização multiparamétrica e UTI em tempo real</li>
        <li>Protocolos RECOVER 2024 e Farmacocinética/Farmacodinâmica completa</li>
        <li>Geração e exportação de laudos e pareceres anestésicos ilimitados</li>
        <li>Sessão protegida e suporte especializado</li>
      </ul>

      <div style="text-align: center; margin: 30px 0 10px;">
        <a href="https://anest.sopet.app" class="btn">Acessar Simulador Agora</a>
      </div>

      ${paymentDetails.invoiceUrl ? `
      <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 14px;">
        Você também pode visualizar a fatura completa no Asaas <a href="${paymentDetails.invoiceUrl}" target="_blank" style="color: #10b981; text-decoration: underline;">clicando aqui</a>.
      </p>
      ` : ''}
    </div>
    <div class="footer">
      ANEST-VET Simulador Veterinário · Gestão de Negócios: arbor.br@aol.com<br>
      © ${new Date().getFullYear()} ANEST-VET. Todos os direitos reservados.
    </div>
  </div>
</body>
</html>
    `;

    return await this.sendMailWithFallback({
      from: this.config.from,
      to: cleanTo,
      subject,
      html,
    });
  }
}

export const emailService = new EmailService();
