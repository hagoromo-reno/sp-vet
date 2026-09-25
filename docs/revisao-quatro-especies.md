# Revisão do simulador — quatro espécies

Escopo: caninos, felinos, equinos e bovinos. O catálogo mantém os 41 medicamentos e soluções existentes. Foram removidos os perfis, doses e cenários de aves e coelhos; nenhuma dose foi extrapolada de outra espécie para preencher lacunas.

## Mudanças

- A farmacopeia mostra somente itens com regime cadastrado para a espécie. O grupo de fluidos também inclui sangue e coloides, quando cadastrados.
- Consultar CRI sem taxa específica não retorna mais a dose de bólus. A troca de modo atualiza a dose na unidade correta, e a troca de espécie reinicializa a seleção e a via.
- Pacientes personalizados recebem peso inicial compatível com a espécie, referências próprias de SpO₂, EtCO₂ e hematócrito, e pressão sistólica/diastólica coerente com a PAM inicial.
- O cálculo de déficit e recuperação de oxigênio acompanha o consumo basal configurado por espécie. Oferta de oxigênio integra hemoglobina, saturação, oxigênio dissolvido e débito cardíaco.
- Lactato responde à insuficiência de oferta de oxigênio, inclusive na anemia com SpO₂ preservada. Sua recuperação depende da perfusão hepática e renal; foi removida a associação indevida à glicuronidação felina.
- O painel **Biofísica → Relações entre sistemas** apresenta as ligações e os sinais causais ativos, com dados do paciente.
- Exame físico interpreta os valores de reflexos e tempo de preenchimento capilar realmente emitidos pelo motor. Ausência de reflexo palpebral deixou de ser apresentada isoladamente como confirmação de plano cirúrgico ideal.

## Verificação

As regressões cobrem consistência das quatro espécies, separação de taxa e bólus, estabilidade basal por dez minutos, recuperação de lactato sob perfusão reduzida e anemia grave com saturação preservada. Os testes comparativos antigos passaram a fornecer o passo de tempo no formato aceito pelo executor; os testes de áudio e ressuscitação usam o contrato atual do simulador.

## Base fisiológica e limites

A associação entre ventilação, CO₂, pressão, temperatura e metabolismo é apoiada pelas [diretrizes de anestesia da AAHA](https://www.aaha.org/resources/2020-aaha-anesthesia-and-monitoring-guidelines-for-dogs-and-cats/troubleshooting-anesthetic-complications/). O papel da perfusão, da capacidade de transporte de oxigênio e do lactato é descrito no [Merck Veterinary Manual — monitorização do paciente crítico](https://www.merckvetmanual.com/emergency-medicine-and-critical-care/monitoring-the-critically-ill-small-animal/monitoring-the-critically-ill-small-animal-using-the-rule-of-20).

As diferenças de farmacocinética entre espécies e condições orgânicas são discutidas no [Merck Veterinary Manual — farmacocinética](https://www.merckvetmanual.com/pharmacology/pharmacology-introduction/pharmacokinetics). A maior sensibilidade cardiovascular felina à lidocaína está descrita no [capítulo de analgesia local e regional](https://www.merckvetmanual.com/therapeutics/pain-assessment-and-management/local-and-regional-analgesic-techniques-in-animals). Essas referências apoiam relações fisiológicas, não validam os coeficientes do software.

Os multiplicadores de demanda de O₂ (1,5 para déficit e 1,8 para recuperação), a ponderação hepatorrenal de lactato e os tempos de resposta são calibrações educacionais. As concentrações PK/PD permanecem normalizadas ao catálogo. Testes de consistência e tendências não constituem validação clínica das doses, probabilidades de complicações ou tempos de recuperação. O modelo nativo Pulse continua restrito ao perfil canino e mantém sua política de autoridade anterior; os quatro perfis são simulados pelo motor veterinário local.
