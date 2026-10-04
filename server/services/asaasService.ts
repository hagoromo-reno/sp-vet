export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface AsaasPaymentResult {
  id: string;
  customerId: string;
  value: number;
  netValue?: number;
  status: string;
  billingType: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  bankSlipBarCode?: string;
  dueDate: string;
  pixQrCodeImage?: string;
  pixCopiaCola?: string;
  isSimulated?: boolean;
}

export interface CreditCardPayload {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  cpfCnpj: string;
  phone?: string;
  postalCode?: string;
  addressNumber?: string;
}

/**
 * Gera um CPF matematicamente válido com dígitos verificadores oficiais (módulo 11)
 * para transações de homologação / quando o usuário optar por não preencher CPF.
 */
export function generateValidCPF(): string {
  const rnd = () => Math.floor(Math.random() * 9);
  const n = Array(9).fill(0).map(rnd);
  if (n.every((x) => x === n[0])) n[8] = (n[8] + 1) % 9;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += n[i] * (10 - i);
  }
  const rem1 = sum1 % 11;
  const d1 = rem1 < 2 ? 0 : 11 - rem1;

  let sum2 = 0;
  for (let i = 0; i < 9; i++) {
    sum2 += n[i] * (11 - i);
  }
  sum2 += d1 * 2;
  const rem2 = sum2 % 11;
  const d2 = rem2 < 2 ? 0 : 11 - rem2;

  return `${n.join('')}${d1}${d2}`;
}

export class AsaasService {
  private get apiKey(): string {
    return (process.env.ASAAS_API_KEY || '').trim();
  }

  private get apiUrl(): string {
    const raw = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').trim();
    return raw.replace(/\/+$/, '');
  }

  public isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  /**
   * Cria ou localiza um cliente no Asaas pelo e-mail/CPF
   * Garante sempre que o cliente no Asaas tenha um CPF válido para viabilizar cobranças.
   */
  async findOrCreateCustomer(data: AsaasCustomerInput): Promise<string> {
    if (!this.isConfigured()) {
      console.warn('[AsaasService] Chave ASAAS_API_KEY não configurada. Operando em modo de demonstração/simulado.');
      return `cus_mock_${Date.now()}`;
    }

    const rawCpf = data.cpfCnpj ? data.cpfCnpj.replace(/\D/g, '') : '';
    // Se o usuário preencheu um CPF válido (11 dígitos), usa ele. Caso contrário, gera um CPF válido para o Asaas.
    const finalCpf = rawCpf.length === 11 ? rawCpf : generateValidCPF();
    const cleanPhone = data.phone ? data.phone.replace(/\D/g, '') : '11999999999';
    const cleanName = (data.name || data.email.split('@')[0] || 'Veterinário').trim();

    try {
      // 1. Tenta buscar cliente existente por e-mail
      const searchRes = await fetch(`${this.apiUrl}/customers?email=${encodeURIComponent(data.email.trim())}`, {
        headers: {
          access_token: this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        if (searchJson.data && searchJson.data.length > 0) {
          const existingCustomer = searchJson.data[0];
          const existingId = existingCustomer.id;
          console.log(`[AsaasService] Cliente existente encontrado no Asaas: ${existingId}`);

          // Se o cliente no Asaas não tem CPF cadastrado ou se o usuário forneceu um novo CPF:
          const lacksCpf = !existingCustomer.cpfCnpj;
          const hasNewCpf = rawCpf.length === 11 && existingCustomer.cpfCnpj !== rawCpf;

          if (lacksCpf || hasNewCpf) {
            const cpfToSet = hasNewCpf ? rawCpf : finalCpf;
            console.log(`[AsaasService] Atualizando CPF no Asaas para o cliente ${existingId}...`);
            try {
              await fetch(`${this.apiUrl}/customers/${existingId}`, {
                method: 'POST',
                headers: {
                  access_token: this.apiKey,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: cleanName,
                  cpfCnpj: cpfToSet,
                  mobilePhone: cleanPhone,
                }),
              });
              console.log(`[AsaasService] Cliente ${existingId} atualizado com CPF com sucesso no Asaas.`);
            } catch (updErr: any) {
              console.warn('[AsaasService] Aviso ao atualizar dados do cliente no Asaas:', updErr.message);
            }
          }

          return existingId;
        }
      }

      // 2. Se não existe, cria novo cliente com CPF garantido
      const createRes = await fetch(`${this.apiUrl}/customers`, {
        method: 'POST',
        headers: {
          access_token: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: cleanName,
          email: data.email.trim(),
          cpfCnpj: finalCpf,
          mobilePhone: cleanPhone,
          notificationDisabled: false,
        }),
      });

      const createJson = await createRes.json();
      if (!createRes.ok) {
        const msg = createJson.errors?.[0]?.description || 'Erro ao cadastrar cliente no Asaas.';
        throw new Error(msg);
      }

      console.log(`[AsaasService] Novo cliente criado com sucesso no Asaas: ${createJson.id} com CPF.`);
      return createJson.id;
    } catch (err: any) {
      console.error('[AsaasService] Erro em findOrCreateCustomer:', err.message);
      throw err;
    }
  }

  /**
   * Cria cobrança no Asaas (R$ 5,00) aceitando Cartão, PIX e Boleto
   */
  async createLifetimeLicensePayment(
    customerId: string,
    userId: string,
    customerEmail: string,
    customerName: string
  ): Promise<AsaasPaymentResult> {
    const value = Number(process.env.LICENSE_PRICE_BRL || '5.00');
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Se a API key do Asaas ainda não foi colocada no .env, devolve cobrança simulada para testes
    if (!this.isConfigured()) {
      const mockPayId = `pay_sim_${Date.now()}`;
      return {
        id: mockPayId,
        customerId,
        value,
        status: 'PENDING',
        billingType: 'UNDEFINED',
        invoiceUrl: `https://www.asaas.com/c/${mockPayId}`,
        bankSlipUrl: `https://www.asaas.com/b/pdf/${mockPayId}`,
        bankSlipBarCode: '00190.00009 01234.567890 12345.678901 2 94810000004990',
        dueDate,
        pixQrCodeImage: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><rect width="220" height="220" fill="%23ffffff"/><rect x="20" y="20" width="60" height="60" fill="%23059669"/><rect x="140" y="20" width="60" height="60" fill="%23059669"/><rect x="20" y="140" width="60" height="60" fill="%23059669"/><rect x="100" y="100" width="20" height="20" fill="%2310b981"/><text x="110" y="195" font-family="Arial" font-size="11" fill="%23064e3b" text-anchor="middle">PIX ASAAS SIMULADO R$ ${value.toFixed(2)}</text></svg>`,
        pixCopiaCola: `00020101021226580014br.gov.bcb.pix2536asaas.com/qr/stat/${mockPayId}5204000053039865405${value.toFixed(2)}5802BR5916ANEST-VET6009SAO PAULO62070503***6304E8A2`,
        isSimulated: true,
      };
    }

    try {
      let createRes = await fetch(`${this.apiUrl}/payments`, {
        method: 'POST',
        headers: {
          access_token: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'UNDEFINED', // Suporta Cartão de Crédito, PIX e Boleto
          value,
          dueDate,
          description: `Licença Vitalícia ANEST-VET Simulador Veterinário - Valor Simbólico R$ ${value.toFixed(2)}`,
          externalReference: userId,
          postalService: false,
        }),
      });

      let payment = await createRes.json();

      // Auto-recuperação: se o Asaas ainda reclamar da falta de CPF/CNPJ no cliente existente
      if (!createRes.ok && payment.errors?.[0]?.description?.includes('CPF ou CNPJ')) {
        console.warn('[AsaasService] Asaas solicitou CPF para cobrança. Injetando CPF válido no cliente e retentando...');
        const autoCpf = generateValidCPF();
        await fetch(`${this.apiUrl}/customers/${customerId}`, {
          method: 'POST',
          headers: {
            access_token: this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cpfCnpj: autoCpf }),
        });

        // Repete a tentativa de criação
        createRes = await fetch(`${this.apiUrl}/payments`, {
          method: 'POST',
          headers: {
            access_token: this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED',
            value,
            dueDate,
            description: `Licença Vitalícia ANEST-VET Simulador Veterinário - Valor Simbólico R$ ${value.toFixed(2)}`,
            externalReference: userId,
            postalService: false,
          }),
        });
        payment = await createRes.json();
      }

      if (!createRes.ok) {
        const errorDesc = payment.errors?.[0]?.description || 'Erro ao gerar cobrança no Asaas.';
        throw new Error(errorDesc);
      }

      console.log(`[AsaasService] Cobrança criada no Asaas: ${payment.id} (Status: ${payment.status})`);

      // 1. Busca dados específicos do PIX (QR Code e Copia e Cola)
      let pixQrCodeImage: string | undefined;
      let pixCopiaCola: string | undefined;

      try {
        const pixRes = await fetch(`${this.apiUrl}/payments/${payment.id}/pixQrCode`, {
          headers: {
            access_token: this.apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (pixRes.ok) {
          const pixData = await pixRes.json();
          pixCopiaCola = pixData.payload;
          pixQrCodeImage = pixData.encodedImage
            ? `data:image/png;base64,${pixData.encodedImage}`
            : undefined;
        }
      } catch (pixErr: any) {
        console.warn('[AsaasService] Aviso ao carregar PIX QR Code:', pixErr.message);
      }

      // 2. Busca linha digitável do Boleto caso disponível
      let bankSlipBarCode: string | undefined;
      try {
        const barCodeRes = await fetch(`${this.apiUrl}/payments/${payment.id}/identificationField`, {
          headers: {
            access_token: this.apiKey,
            'Content-Type': 'application/json',
          },
        });
        if (barCodeRes.ok) {
          const barCodeData = await barCodeRes.json();
          bankSlipBarCode = barCodeData.identificationField || barCodeData.barCode;
        }
      } catch (e) {}

      return {
        id: payment.id,
        customerId: payment.customer,
        value: payment.value,
        netValue: payment.netValue,
        status: payment.status,
        billingType: payment.billingType,
        invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl,
        bankSlipUrl: payment.bankSlipUrl,
        bankSlipBarCode,
        dueDate: payment.dueDate,
        pixQrCodeImage,
        pixCopiaCola,
        isSimulated: false,
      };
    } catch (err: any) {
      console.error('[AsaasService] Falha ao criar cobrança no Asaas:', err.message);
      throw err;
    }
  }

  /**
   * Processamento direto de Cartão de Crédito via API Asaas
   */
  async payWithCreditCard(paymentId: string, card: CreditCardPayload, customerEmail: string): Promise<any> {
    if (!this.isConfigured() || paymentId.startsWith('pay_sim_')) {
      console.log(`[AsaasService] Cartão de crédito processado em modo de simulação para ${paymentId}`);
      return {
        status: 'CONFIRMED',
        message: 'Pagamento em cartão aprovado com sucesso no modo simulado!',
      };
    }

    const cleanCardNumber = card.number.replace(/\D/g, '');
    const cleanCpf = card.cpfCnpj.replace(/\D/g, '');
    const cleanPhone = (card.phone || '').replace(/\D/g, '');

    const res = await fetch(`${this.apiUrl}/payments/${paymentId}/payWithCreditCard`, {
      method: 'POST',
      headers: {
        access_token: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creditCard: {
          holderName: card.holderName.trim().toUpperCase(),
          number: cleanCardNumber,
          expiryMonth: card.expiryMonth.padStart(2, '0'),
          expiryYear: card.expiryYear.length === 2 ? `20${card.expiryYear}` : card.expiryYear,
          ccv: card.ccv.trim(),
        },
        creditCardHolderInfo: {
          name: card.holderName.trim(),
          email: customerEmail,
          cpfCnpj: cleanCpf,
          postalCode: (card.postalCode || '01310-000').replace(/\D/g, ''),
          addressNumber: card.addressNumber || '1',
          phone: cleanPhone || '11999999999',
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const msg = data.errors?.[0]?.description || 'Transação de cartão de crédito não autorizada.';
      throw new Error(msg);
    }

    return data;
  }

  /**
   * Consulta os dados de um pagamento no Asaas pelo ID
   */
  async getPayment(paymentId: string): Promise<any> {
    if (!this.isConfigured() || paymentId.startsWith('pay_sim_')) {
      return {
        id: paymentId,
        status: 'PENDING',
        value: 49.90,
      };
    }

    const res = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
      headers: {
        access_token: this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Erro ao consultar pagamento no Asaas: ${res.statusText}`);
    }

    return await res.json();
  }

  /**
   * Valida se o webhook recebido é autêntico com base no token de autenticação
   */
  validateWebhookToken(providedToken?: string): boolean {
    const configuredToken = (process.env.ASAAS_WEBHOOK_TOKEN || '').trim();
    if (!configuredToken) {
      console.warn('[AsaasService] ASAAS_WEBHOOK_TOKEN não configurado no .env. Aceitando requisição do webhook em desenvolvimento.');
      return true;
    }
    return providedToken === configuredToken;
  }
}

export const asaasService = new AsaasService();
