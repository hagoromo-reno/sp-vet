# Guia de Publicação em VPS com Portainer, PostgreSQL e Gestão de Assinantes

Este documento orienta o processo de implantação do **SP-VET** em uma VPS executando Docker / Portainer, integrando-se diretamente ao cluster de banco de dados PostgreSQL com PgBouncer na rede `PetSoftNet`.

---

## 1. Arquitetura de Produção e Conexão ao Banco

A sua VPS já possui os serviços `postgres` (PostgreSQL 14) e `pgbouncer` (`postgres-pool:6432`) configurados na rede `PetSoftNet`.

O **SP-VET** conecta-se diretamente ao alias `postgres-pool` na porta `6432`:
- **Host**: `postgres-pool`
- **Porta**: `6432` (PgBouncer com `pool_mode: transaction`)
- **Usuário**: `postgres`
- **Senha**: `19dd7b730f9dd8a558ceb1d94dce7e8b`
- **Banco**: `postgres`

### Criação Automática do Esquema (Auto-Migration)
Ao iniciar o container pela primeira vez, o servidor Express executa automaticamente o script de inicialização do banco (`server/db/schema.ts`), criando as tabelas com integridade relacional:
1. `users`: dados de cadastro, nível de acesso (`admin`, `veterinarian`, `student`), status de assinatura (`active`, `inactive`, `trial`) e validade.
2. `user_sessions`: controle de sessões em tempo real, tokens criptográficos, IP e agente.
3. `professional_perspectives`: armazenamento das condutas anestésicas, dosagens, telemetria e reflexões clínicas de cada profissional.
4. **Seed Automático**: cria o usuário Administrador Mestre (`admin@spvet.com` / `admin123`) e uma conta de demonstração (`demo@spvet.com` / `demo123`).

---

## 2. Política de Conexão Não-Concorrente (Proteção SaaS)

Para viabilizar a comercialização do software como serviço (SaaS por assinatura), foi implementado o mecanismo de **Sessão Única Obrigatória**:

1. **Apenas 1 conexão ativa por usuário**:
   - Quando o `Usuário A` efetua login no Dispositivo B (ex: celular ou outro navegador), o sistema localiza todas as sessões anteriores ativas deste usuário no banco e atualiza imediatamente para `is_active = FALSE` com o motivo `concurrency_limit`.
2. **Batimento em Tempo Real (Heartbeat)**:
   - A cada 20 segundos, o frontend envia um batimento para `/api/auth/heartbeat`.
   - Se a sessão do Dispositivo A foi invalidada pelo login no Dispositivo B, o Dispositivo A recebe imediatamente a resposta `401 CONCURRENT_LOGIN_DETECTED`.
   - O aplicativo no Dispositivo A é instantaneamente bloqueado, exibindo a mensagem:
     > *"Sua conta foi conectada em outro dispositivo. Conexões simultâneas não são permitidas pela assinatura."*
   - O usuário no primeiro dispositivo é redirecionado para a tela de login.

---

## 3. Painel de Gestão do Administrador (Admin Dashboard)

O usuário administrador possui acesso a um painel dedicado diretamente na barra superior do simulador (botão **Admin**):

### Funcionalidades:
- **Visão Geral e Métricas**:
  - Total de usuários cadastrados;
  - Total de assinaturas ativas;
  - Usuários em período de demonstração (*Free Trial*);
  - Assinaturas inativas / bloqueadas;
  - Conexões online no momento exato;
  - Total de pareceres e perspectivas gravadas.
- **Gestão de Usuários**:
  - Cadastrar novos profissionais (Nome, E-mail, Senha provisória, Perfil);
  - Alterar o status da assinatura em 1 clique:
    - **Ativar**: plano pago sem expiração ou com data de renovação;
    - **Free Trial**: define prazo em dias (ex: 7 dias de avaliação);
    - **Inativar**: revoga o acesso imediatamente;
    - **Bloquear**: suspende a conta por completo;
  - Excluir usuários.
- **Monitor de Sessões em Tempo Real**:
  - Visualiza quem está conectado agora, IP de origem, dispositivo e horário do último batimento;
  - Botão **"Derrubar Conexão"**: revoga forçadamente a sessão de qualquer usuário online.
- **Perspectivas dos Profissionais**:
  - Tabela com os relatos de conduta, dosagens e reflexões clínicas que os veterinários salvaram durante as simulações.

---

## 4. Publicação com GitHub Actions (GHCR) e Portainer

O fluxo de publicação foi configurado para compilar a imagem no GitHub e publicá-la no **GitHub Container Registry (GHCR)** sob `ghcr.io/kiryuureno/sp-vet:latest`, exatamente no padrão dos seus outros serviços (`petsoft_web`, `petsoft_server`).

### Passo 1: Enviar o código para o GitHub
O workflow automatizado [deploy.yml](file:///c:/Code2/sp-vet/.github/workflows/deploy.yml) já está pronto. Ao fazer um `git push` para o GitHub na branch `main` ou `master`:
1. O GitHub Actions compila o frontend e o servidor em multi-stage.
2. Faz login no GHCR usando o token nativo do repositório.
3. Publica a imagem pronta em `ghcr.io/kiryuureno/sp-vet:latest`.

> **Dica**: No GitHub, caso o repositório seja privado, você pode vincular o pacote GHCR ao Portainer em **Portainer -> Registries -> Add registry -> Custom registry** (`ghcr.io` com seu usuário e um GitHub Personal Access Token com permissão `read:packages`), ou tornar o pacote da imagem público em **Package Settings -> Danger Zone -> Change visibility -> Public**.

---

### Passo 2: Stack no Portainer com Traefik (HTTPS Automático)

No **Portainer**, vá em **Stacks -> Add stack**, informe o nome `sp-vet` e utilize o compose abaixo:

```yaml
version: "3.7"

services:
  sp_vet:
    image: ghcr.io/hagoromo-reno/sp-vet:latest
    healthcheck:
      disable: true
    networks:
      - PetSoftNet
    environment:
      - PORT=3000
      - NODE_ENV=production

      # 1. Conexão para o dia a dia do app (via PgBouncer na porta 6432)
      - DATABASE_URL=postgresql://postgres:19dd7b730f9dd8a558ceb1d94dce7e8b@pgbouncer:6432/postgres?schema=public&pgbouncer=true

      # 2. Conexão para Migrações/DDL (direto no Postgres na porta 5432)
      - DIRECT_URL=postgresql://postgres:19dd7b730f9dd8a558ceb1d94dce7e8b@postgres:5432/postgres?schema=public

      - SESSION_SECRET=c29wZXQtc3AtdmV0LWV4Y2x1c2l2by0yMDI2
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      resources:
        limits:
          cpus: "1"
          memory: 1024M
      labels:
        - traefik.enable=true
        - traefik.http.routers.sp_vet.rule=Host(`anest.sopet.app`)
        - traefik.http.routers.sp_vet.entrypoints=websecure
        - traefik.http.routers.sp_vet.tls.certresolver=letsencryptresolver
        - traefik.http.routers.sp_vet.priority=1
        - traefik.http.routers.sp_vet.service=sp_vet
        - traefik.http.services.sp_vet.loadbalancer.server.port=3000
        - traefik.http.services.sp_vet.loadbalancer.passHostHeader=true
        - traefik.docker.network=PetSoftNet
    restart: unless-stopped

networks:
  PetSoftNet:
    external: true
    name: PetSoftNet
```

### O que o Traefik faz automaticamente:
* Reconhece as requisições para `anest.sopet.app` (e `anest.soppet.app`).
* Emite e renova o certificado SSL Let's Encrypt automaticamente.
* Encaminha o tráfego HTTP/HTTPS e WebSockets para o container na porta interna `3000`.

---

## 5. Primeiro Acesso

Após a publicação:
1. Acesse o endereço IP ou domínio da sua VPS: `http://SEU_IP_OU_DOMINIO:3000`.
2. A tela de login solicitará autenticação:
   - **Administrador**: `admin@spvet.com` | Senha: `admin123`
   - **Conta Demonstração (Trial)**: `demo@spvet.com` | Senha: `demo123`
3. Ao entrar como administrador, clique no botão **Admin** na barra superior para criar e gerenciar os acessos dos seus clientes e assinantes.
