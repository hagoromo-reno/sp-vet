# Revisão das simulações por anestesiologistas

Implementação de 10/09/2026 para CAN, FEL, BOV e EQUI. A revisão é acessada pelo botão **Revisão por anestesiologista**, acima do monitor. Abrir o painel pausa a execução; fechar o painel mantém a pausa até o operador retomar.

## Fluxo de trabalho

1. Execute o caso e faça as intervenções. O sistema cria um identificador exclusivo para cada rodada, inclusive em reinícios do mesmo paciente.
2. Abra a revisão e escolha a rodada e o minuto. Existem também um ponto inicial e um ponto final após encerramento, reinício ou óbito. Para compartilhar uma rodada estável, use **Encerrar rodada**.
3. Informe avaliador e qualificação, marque plausível, precisa de ajuste ou inconclusivo, e preencha as faixas esperadas dos parâmetros avaliados. Campos vazios permanecem não avaliados. Valores exatos podem ser repetidos nos dois limites.
4. Descreva a evolução que esperava naquele contexto e a justificativa. Reflexos, ritmo, plano, resposta nociceptiva e outros aspectos qualitativos podem ser detalhados no texto. Se informar latência esperada, associe um evento anterior ao ponto avaliado.
5. Salve cada parecer antes de trocar de ponto ou fechar a revisão. **Revisar parecer** cria uma versão nova sem remover a anterior; revisões de outros profissionais continuam independentes.
6. Exporte **Rodada JSON** para compartilhar ou manter backup. O destinatário importa a rodada, registra seu parecer e devolve o JSON. Importar novamente a mesma rodada reúne os pareceres sem substituir a telemetria local; conflitos de dados ou de identificadores são rejeitados.
7. **Dados para refino / IA** exporta JSONL com um exemplo por parecer vigente. **Análise dos pareceres** reúne desvios por espécie e parâmetro e identifica faixas discordantes entre avaliadores.

## O que fica registrado

- Identificador da rodada, paciente e cenário completos, espécie, versão do modelo, identificação do motor e impressão SHA-256 do código da compilação. Novas rodadas também conservam configuração da espécie, particularidades celulares e catálogo farmacológico.
- Horário real ISO 8601 em UTC e tempo simulado em segundos. A interface converte o horário real para o fuso local. Aceleração e pausa são estados distintos registrados na auditoria.
- Estado inicial, amostras a cada 60 segundos simulados e amostra final. Cada amostra conserva parâmetros fisiológicos completos, estados orgânicos, reflexos, doses e compartimentos PK, equipamento, ventilador, fluidos, ressuscitação e estímulos.
- Pressão invasiva ou última aferição NIBP, com o tempo em que foi medida. Uma NIBP não medida não é substituída por pressão calculada. A tabela de comparação indica explicitamente que mostra valores calculados pelo motor.
- Alterações de estado, textos dos logs existentes, comandos rejeitados registrados pela interface, transições de ritmo, apneia, PCR, óbito, alertas e ativação/resolução de sinais entre sistemas. Os eventos recebem UUID, sequência, horário e estado fisiológico associado; mudanças conservam antes/depois.
- Eventos anteriores próximos são associados temporalmente aos desdobramentos. Essa associação não demonstra que uma intervenção causou o desfecho, especialmente sob exposições simultâneas.
- As amostras não são interpoladas. Quando o coletor recebe um salto que ultrapassa minutos, registra a lacuna e o instante efetivo da observação, sem inventar leituras intermediárias. Na interface, os passos de 0,1/0,2/0,5 s atingem as fronteiras de minuto sem deriva do relógio.

O registro por minuto é a resolução solicitada para o curso. Ele não representa uma recomendação clínica universal de frequência de documentação. As diretrizes ACVAA de 2025 recomendam registro do evento perianestésico, intervenções e parâmetros e discutem frequências de documentação diferentes da amostragem adotada aqui: [ACVAA 2025](https://www.vaajournal.org/article/S1467-2987%2825%2900071-6/fulltext).

## Armazenamento e limites operacionais

Os dados são persistidos em IndexedDB, banco `simpet-expert-review`, coleção `runs`, neste navegador, origem e dispositivo. Alterações de eventos, novos minutos e encerramentos disparam salvamento; o último estado também é salvo aproximadamente a cada cinco segundos durante atividade. Falhas aparecem na interface e oferecem exportação da cópia em memória. Uma interrupção abrupta pode perder a parte posterior à última transação concluída. Salvamento no fechamento da aba é uma tentativa adicional, não uma garantia do navegador.

Recarregar inicia uma rodada nova; as antigas ficam disponíveis para consulta. Registros que ficaram abertos não significam execução clínica concluída. Não há retomada do motor de uma rodada antiga, autenticação profissional, assinatura digital ou servidor central de pareceres nesta implementação. A autoria é declarada. Compartilhamento entre dispositivos ocorre por exportação/importação. Limpeza de dados do navegador remove o arquivo local; mantenha cópias exportadas. Nenhum parecer é enviado automaticamente a serviço de IA.

JSON de importação é limitado a 50 MB, com verificação de versão, espécie, parâmetros finitos, identificadores, sequência de eventos e vínculos entre pareceres e amostras. Transações de gravação conservam os pareceres quando novos dados da simulação são salvos. Importação de telemetria divergente com o mesmo identificador é rejeitada. O código em desenvolvimento recebe uma impressão ao iniciar o Vite; reinicie o servidor e a rodada após alterações no código antes de coletar dados formais. Compilações de produção possuem impressão fixa própria.

## Retroalimentação e uso dos dados

O painel apresenta a diferença entre o minuto selecionado e a amostra anterior junto aos mecanismos ativos emitidos pelo modelo. Para cada faixa manual, o desvio é zero dentro dela, negativo abaixo do mínimo e positivo acima do máximo. A análise agregada mantém unidades separadas, conta avaliadores declarados e aponta faixas sem interseção. Ela não transforma discordância em média clínica nem considera campo vazio um acerto.

Cada exemplo JSONL traz paciente, versão/configuração, amostra, eventos até aquele instante, parecer e comparação. Pareceres substituídos ficam no JSON completo, mas não duplicam os exemplos vigentes. Os rótulos são identificados como `expert_opinion_not_adjudicated`, inclusive opiniões inconclusivas. O processo de refino deve selecionar os pareceres adequados, resolver discordâncias e separar rodadas/pacientes entre ajuste e validação. Dados de teste técnico devem ser excluídos de qualquer conjunto clínico.

Para fechar o ciclo: investigar os parâmetros com divergências recorrentes, formular uma alteração explícita e limitada ao mecanismo identificado, executar as regressões e a auditoria temporal novamente e solicitar nova avaliação em rodadas independentes. O sistema não altera doses, coeficientes ou limites clínicos automaticamente com base nos pareceres.

## Análise das quatro espécies e ajustes realizados

A [auditoria temporal](./auditoria-temporal-especies.md) documenta 24 execuções e 240 pontos por minuto. Cada espécie foi exposta, em comparações controladas de dez minutos, a controle, acepromazina, xilazina, propofol, cetamina e xilazina + cetamina. Usaram-se doses típicas cadastradas e ventilação assistida constante dentro de cada espécie. O [JSON detalhado](./auditoria-temporal-especies.json) contém os valores, respostas qualitativas esperadas pelo contrato existente e mecanismos por minuto.

| Espécie | Resposta observada no ensaio | Interpretação e prioridade para avaliação humana |
|---|---|---|
| CAN | Controle com FC 88,9–92,2 bpm; xilazina reduziu FC até 67,4; propofol reduziu PAM até 63,0 mmHg; cetamina elevou PAM até 117,4. | Tendências de sedação simpaticolítica, depressão por hipnótico e estimulação dissociativa estão separadas. Especialistas devem julgar magnitude e latência, principalmente o ganho pressórico da cetamina e combinações. |
| FEL | Controle com FC 145,0–145,8 bpm; xilazina reduziu FC até 106,1; propofol reduziu PAM até 64,2. | O motor conserva frequência basal felina e distingue hipnose de analgesia. Validar duração, depressão respiratória sem suporte, laringoespasmo e toxicidade específica; estes últimos não são conclusões desse ensaio ventilado. |
| BOV | Controle com FC 65,0–65,4 bpm; xilazina reduziu FC até 46,2; propofol reduziu PAM até 65,3. | A dose deve permanecer a cadastrada para bovinos. A normalização PK/PD pode aproximar amplitudes entre espécies, portanto a sensibilidade aparente não valida concentrações absolutas. Investigar ventilação espontânea, decúbito, timpanismo e evolução prolongada em rodadas específicas. |
| EQUI | Controle com FC 36,0–36,2 bpm; xilazina reduziu FC até 28,1; propofol reduziu PAM até 62,1. | O alarme genérico de FC não era adequado a esse basal. A pressão baixa merece revisão junto a perfusão, decúbito e risco muscular. Validar separadamente recuperação e trocas gasosas durante anestesia prolongada. |

Esses valores são **saídas do simulador**, não intervalos esperados em pacientes reais. As tendências descritas para pequenos animais são contextualizadas pelas [diretrizes AAHA](https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/). Alterações de trocas gasosas em equinos são discutidas na [revisão sobre anestesia geral equina](https://pmc.ncbi.nlm.nih.gov/articles/PMC8300395/). Um estudo de [xilazina/cetamina em bezerros neonatos](https://pubmed.ncbi.nlm.nih.gov/3149067/) encontrou hipoxemia associada principalmente a hipoventilação; não autoriza extrapolar seus tempos ou doses para bovinos adultos. As fontes contextualizam relações fisiológicas e limites da análise, não validam os coeficientes do software.

Correções concretas desta revisão:

- Removido arredondamento da temperatura usada como estado de integração: passos de 0,1 s antes podiam apagar a perda térmica. O visor continua responsável por arredondar o valor exibido.
- Manta respeita regulagem e alvo basal; deixou de impor queda instantânea para 38,8 °C em um paciente quente. As taxas de transferência permanecem calibrações educacionais.
- Contadores de assistolia e RCP preservam frações de segundo. O arredondamento anterior podia congelar contadores em 1×/2× e duplicá-los em 5×. Os tempos de morte do modelo não foram reinterpretados como limites clínicos universais.
- Comandos de RCP com frequência ou profundidade zero permanecem na auditoria, mas não geram circulação, ROSC ou contagem de compressões efetivamente executadas. O tempo sem compressões continua acumulando; zero deixou de ser convertido na qualidade padrão de 0,8.
- Limites iniciais de FC passam a derivar da referência da espécie (80% do mínimo e 115% do máximo de referência), com PAM vinculada ao limiar já existente no modelo. São limites educacionais de monitorização; exigem interpretação específica ao caso. Isso evita alarme basal indevido no equino. Preferência de áudio é preservada na troca de paciente.
- Relógio da interface é estabilizado em décimos de segundo, incluindo amostragem e fim de estímulos nociceptivos. Logs de administração explicitam unidade, via, duração de entrega e identificador da dose.

## Verificação

- `npm test`: 169 testes passaram, incluindo amostragem com mudanças de velocidade, isolamento de rodadas, fim de execução, importação inválida, fusão de pareceres, discordância, faixas/unidades, compressões nulas, quatro espécies e progressão térmica/RCP/assistolia em 1×, 2× e 5×.
- `npm run validate:pharmacology`: 43 itens, 489 casos executados, nenhum desvio do contrato educacional existente.
- `npm run validate:interactions`: 32 cenários aprovados.
- `npm run validate:species`: 24 execuções e 240 pontos documentados; comando regenera os artefatos.
- TypeScript e compilação de produção verificados. Teste manual no navegador confirmou pausa ao abrir revisão, salvamento de parecer sintético, minutos em 5×, encerramento e preservação após recarregar.

Essas verificações demonstram consistência técnica e cumprimento dos contratos de teste. A validação externa de realismo clínico permanece dependente das revisões independentes dos anestesiologistas que este fluxo permite coletar.
