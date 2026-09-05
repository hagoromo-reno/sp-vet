# Motor fisiológico canino — integração Pulse

## Estado atual

O modelo `canine-adult-whole-body-alpha` é experimental e opera somente em modo sombra. Ele recebe o mesmo relógio, paciente, equipamento, estímulo cirúrgico e exposição farmacológica da simulação local, mas sua saída não substitui o visor. A promoção para modo autoritativo exige grau `externally_validated` e nenhuma verificação reprovada no snapshot.

Isso é uma barreira deliberada de segurança científica: compilar e estabilizar não equivale a validar um modelo fisiológico.

## Arquitetura executável

```text
Interface React (10 Hz)
        │ WebSocket /physiology — protocolo 1.0.0, SI/unidades explícitas
        ▼
Gateway Node (uma sessão por paciente)
        │ NDJSON por stdin/stdout
        ▼
PulseCanineWorker (um processo/container por paciente)
        │
        ├─ CanineAdultWholeBody controller
        ├─ circuitos cardiovascular e respiratório parametrizados por espécie
        ├─ transporte compartimental e modelos de órgãos do Pulse
        └─ ledger de validação incorporado a cada snapshot
```

Quando o worker não está disponível, o gateway mantém um driver de referência determinístico apenas para validar transporte e interface. Esse driver declara `not_validated` e nunca pode controlar o monitor.

## Alterações feitas no Pulse local

Em `C:\Code2\synth-engine\engine-stable` foi adicionada a opção `CanineAdultWholeBody`, um controlador canino e um perfil de parâmetros de espécie. A montagem comum dos circuitos passou a selecionar:

- débito cardíaco por massa corporal;
- frações de fluxo sistêmico por órgão;
- massas de tecidos por fração da massa corporal;
- complacência torácica por massa;
- espaço morto, volumes de via aérea e volume gástrico escalados por massa.

Os solvers comuns, transporte de gases/líquidos, baro/quimiorreflexos e modelos de órgãos são reutilizados. Constantes ainda sem evidência canina aceita permanecem listadas como hipóteses em `models/canine-adult-alpha/profile.json`.

O perfil usa aquecimento temporal explícito de 1.200 s. O critério dinâmico humano foi inadequado para este primeiro perfil porque amostrava a oscilação respiratória normal da saturação canina como se fosse deriva. Todos os circuitos e feedbacks continuam ativos durante o aquecimento. Os limiares central e periférico do controlador de CO₂ foram calibrados em 37,5 mmHg; pH e gases arteriais continuam sendo resultados do modelo, não valores impostos.

## Compilação reproduzível

No PowerShell, a partir deste projeto:

```powershell
.\scripts\build-pulse-canino.ps1
```

O script usa um toolchain Linux isolado em Docker e instala o resultado em `C:\Code2\synth-engine\build-canino\install`. Quando esse artefato existe, o gateway o detecta e executa automaticamente sem rede. A imagem de execução combina Debian Bookworm, compatível com o binário recém-compilado, e o pacote de dados gerados da imagem oficial `kitware/pulse:4.3.1`. A diferença entre o código 4.3.2 local e os dados 4.3.1 permanece registrada como limitação até produzirmos e congelarmos um pacote de dados 4.3.2 próprio. Também é possível indicar um executável nativo:

```powershell
$env:PULSE_CANINE_WORKER = 'C:\caminho\PulseCanineWorker.exe'
npm run dev:physiology
```

Em outro terminal, execute `npm run dev`.

## Validação basal executável

Execute:

```powershell
npm run validate:physiology:canine
```

O ensaio abre o mesmo WebSocket usado pela interface, inicializa o worker nativo, aquece o modelo por 1.200 s e observa cinco amostras ao longo de 300 s. Cada amostra é comparada a FC, PAM, débito cardíaco indexado, pH, PaCO₂, PaO₂ e VO₂ da coorte de Haskins. Separadamente, limites de engenharia verificam deriva pós-aquecimento.

Resultado basal obtido em 5 de setembro de 2026 para o animal de referência de 20,5 kg:

| Critério | 60 s | 300 s | Deriva | Resultado |
|---|---:|---:|---:|---|
| FC (1/min) | 93,76 | 92,78 | 1,05% | passou |
| PAM (mmHg) | 97,82 | 98,07 | 0,26% | passou |
| Débito (mL/min/kg) | 177,28 | 176,98 | 0,17% | passou |
| pH arterial | 7,406 | 7,413 | 0,0065 | passou |
| PaCO₂ (mmHg) | 40,74 | 40,07 | 1,64% | passou |
| PaO₂ (mmHg) | 85,93 | 88,32 | 2,78% | passou |
| VO₂ (mL/min/kg) | 4,75 | 4,73 | 0,35% | passou |

As 35 comparações com a referência e os sete testes de deriva passaram. Isso constitui calibração basal do perfil de referência, não validação externa, farmacológica, por raça ou por faixa de massa.

## Critérios de promoção

1. Verificação estrutural: compilação, inicialização, unidades, finitude e conservação de massa/volume.
2. Calibração basal: FC, PAM, débito cardíaco indexado, pH, PaCO₂, PaO₂ e consumo de O₂ dentro do intervalo pré-definido da coorte de referência.
3. Validação dinâmica: respostas independentes a hemorragia, ventilação, FiO₂, fluidos, vasopressores, anestésicos e reversores.
4. Validação externa: dados não usados na calibração, estratificados por massa, conformação, sexo, idade e condição corporal.
5. Somente então: habilitar autoridade por domínio, com fallback imediato e comparação contínua contra o motor local.

Não se deve usar este modelo alpha para decisão clínica, cálculo terapêutico em paciente real ou alegação de equivalência fisiológica entre raças.
