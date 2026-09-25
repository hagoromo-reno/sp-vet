# Motor fisiológico canino — integração Pulse

## Estado atual

O modelo `canine-adult-whole-body-alpha` é experimental e opera somente em modo sombra. Ele recebe o mesmo relógio, paciente, equipamento, estímulo cirúrgico e exposição farmacológica da simulação local, mas sua saída não substitui o visor. A promoção para modo autoritativo exige grau `externally_validated` e nenhuma verificação reprovada no snapshot.

Isso é uma barreira deliberada de segurança científica: compilar e estabilizar não equivale a validar um modelo fisiológico.

## Arquitetura executável

```text
Interface React (10 Hz)
        │ WebSocket /physiology — protocolo 1.2.0, unidades explícitas
        ▼
Gateway Node (uma sessão por paciente)
        │ NDJSON por stdin/stdout
        ▼
PulseCanineWorker (um processo/container por paciente)
        │
        ├─ CanineAdultWholeBody controller
        ├─ circuitos cardiovascular e respiratório parametrizados por espécie
        ├─ transporte compartimental e modelos de órgãos do Pulse
        ├─ ponte farmacodinâmica veterinária híbrida (SetExternalEffects)
        └─ ledger de validação e cobertura farmacológica incorporados a cada snapshot
```

Quando o worker não está disponível, o gateway mantém um driver de referência determinístico apenas para validar transporte e interface. Esse driver declara `not_validated` e nunca pode controlar o monitor.

## Alterações feitas no Pulse local

Em `C:\Code2\synth-engine\engine-stable` foi adicionada a opção `CanineAdultWholeBody`, um controlador canino e um perfil de parâmetros de espécie. A montagem comum dos circuitos passou a selecionar:

- débito cardíaco por massa corporal;
- frações de fluxo sistêmico por órgão;
- massas de tecidos por fração da massa corporal;
- complacência torácica por massa;
- espaço morto, volumes de via aérea e volume gástrico escalados por massa.

Além disso, em `DrugModel.h` e `DrugModel.cpp`, foi exposto o ponto de entrada `SetExternalEffects(...)`, acoplando deltas de frequência cardíaca, pressão arterial média, frequência respiratória, volume corrente, sedação, bloqueio neuromuscular e broncodilatação diretamente aos atuadores comuns de sistemas do Pulse (`GetHeartRateChange()`, `GetMeanBloodPressureChange()`, etc.).

Os solvers comuns, transporte de gases/líquidos, baro/quimiorreflexos e modelos de órgãos são reutilizados. Constantes ainda sem evidência canina aceita permanecem listadas como hipóteses em `models/canine-adult-alpha/profile.json`.

## Intervenções e Farmacologia Híbrida no Protocolo 1.2

O adaptador converte intervenções da interface em ações dimensionais do Pulse antes de cada avanço do organismo:

- **via aérea**: extubado, tubo traqueal, intubação esofágica e máscara laríngea;
- **ventilação**: CMV controlada por volume ou pressão, frequência, volume corrente, PEEP, PIP e relação I:E;
- **oxigenoterapia**: fluxo de O₂ e FiO₂ derivada dos fluxos O₂/N₂O;
- **procedimento**: intensidade e metadados cirúrgicos entram como `AcuteStress`, modulados dinamicamente pela inibição nociceptiva fornecida pela ponte de fármacos;
- **farmacologia nativa (PBPK/PD)**: bolus IV/IV lento e CRI, com massa, volume, concentração, duração e taxa volumétrica explícitos para as 8 moléculas nativas suportadas (epinefrina, etomidato, fentanil, cetamina, midazolam, morfina, norepinefrina e propofol);
- **ponte farmacodinâmica veterinária híbrida**: para moléculas veterinárias sem representação PBPK nativa no Pulse (acepromazina, dexmedetomidina, atipamezol, flumazenil, etc.) e para interações de receptores, a camada `pulseHybridBridge.ts` projeta a orquestra celular de receptores do `sp-vet` em vetores de efeito em órgãos, subtraindo os efeitos basais nativos para evitar dupla contagem.
- **observabilidade**: domínios aplicados, entradas recusadas, cobertura farmacológica nominal (`native_pbpk_pd`, `hybrid_veterinary_pd`, `unsupported`), concentração total/livre, carga no modelo e concentração tecidual agregada seguem no snapshot.

Isoflurano e sevoflurano permanecem locais: o pacote de dados disponível contém desflurano, mas usar uma molécula diferente seria farmacologicamente incorreto. Fluidos e hemoderivados utilizam rastreamento volumétrico.

As CRIs simultâneas da mesma molécula são somadas por fluxo de massa. Ao interromper a bomba, o worker envia taxa zero ao Pulse e mantém distribuição e eliminação residuais. Bolus são idempotentes pelo identificador da dose, evitando reaplicação a cada frame.

Durante a revisão foi corrigido um defeito no `SubstanceManager`: o somatório de massa tecidual ignorava o conjunto de compartimentos fornecido pelo chamador e percorria tecidos pais e filhos, com risco de dupla contagem. Agora somente os compartimentos solicitados são somados.

Importante: a `PlasmaConcentration` exposta pelo Pulse ainda é uma proxy computacional. O próprio `DrugModel::CalculatePlasmaSubstanceConcentration` registra que a fórmula atual usa massa vascular total dividida pelo volume plasmático e é uma limitação conhecida. Por isso a interface a separa das estimativas locais, não a chama de exame sérico e mantém todo o núcleo nativo em sombra.

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

Resultado basal obtido em 5 de setembro de 2026 para o animal de referência de 28,5 kg:

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

## Verificação dinâmica executável

Execute:

```powershell
npm run validate:physiology:actions
```

O ensaio usa o mesmo gateway e worker da aplicação e percorre 1.561 s simulados. Em 5 de setembro de 2026, as seis portas passaram:

| Porta de integração | Observação | Resultado |
|---|---|---|
| Procedimento/estresse | ação nativa e mudança autonômica detectadas; retirada permaneceu finita | passou |
| Ventilação CMV-volume | ajuste 12/min; observado 11,49/min; PaO₂ 88,15 → 488,70 mmHg com FiO₂ 1,0 | passou |
| Propofol 4 mg/kg IV | 114 mg administrados; carga máxima 111,91 mg; plasma 28,33 → 1,35 µg/mL após 300 s; PAM 97,69 → 67,21 mmHg | passou |
| Fentanil 10 µg/kg/h | CRI iniciou e parou; plasma 0,00300 → 0,00047 µg/mL após 600 s sem bomba | passou |
| Entradas ausentes | acepromazina e isoflurano foram recusados nominalmente | passou |

Essas portas demonstram propagação causal, resposta dinâmica, queda de concentração e rastreabilidade do adaptador. Elas não demonstram que magnitudes, EC50, distribuição ou depuração sejam corretas para cães: os parâmetros farmacológicos do pacote Pulse continuam predominantemente humanos e precisam de calibração/validação veterinária independente.

Os desafios de ventilação usam valores estudados em cães anestesiados, incluindo volume corrente de 10 mL/kg e PEEP de 5 cmH₂O. O desafio de fentanil usa a ordem de dose de 10 µg/kg/h investigada em cães; esses estudos orientam o desenho do ensaio, não transformam esta implementação em recomendação terapêutica ([Ambrisko et al., 2018](https://pubmed.ncbi.nlm.nih.gov/29688788/); [Sano et al., 2006](https://pubmed.ncbi.nlm.nih.gov/16764592/)).

## Critérios de promoção

1. Verificação estrutural: compilação, inicialização, unidades, finitude e conservação de massa/volume.
2. Calibração basal: FC, PAM, débito cardíaco indexado, pH, PaCO₂, PaO₂ e consumo de O₂ dentro do intervalo pré-definido da coorte de referência.
3. Validação dinâmica: respostas independentes a hemorragia, ventilação, FiO₂, fluidos, vasopressores, anestésicos e reversores.
4. Validação externa: dados não usados na calibração, estratificados por massa, conformação, sexo, idade e condição corporal.
5. Somente então: habilitar autoridade por domínio, com fallback imediato e comparação contínua contra o motor local.

Não se deve usar este modelo alpha para decisão clínica, cálculo terapêutico em paciente real ou alegação de equivalência fisiológica entre raças.
