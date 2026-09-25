# Refinamento integrado do simulador — 7 de setembro de 2026

Escopo: caninos, felinos, bovinos e equinos; catálogo existente de medicamentos.

## Comportamentos implementados

- Infusões entregam quantidade fixa por tempo conforme a taxa prescrita. Não existe dose de ataque implícita: iniciar uma CRI de cetamina ou um protocolo FLK não equivale a administrar um bólus.
- O integrador conserva a quantidade normalizada entre plasma, tecidos, depósito extravascular e eliminação. Parar a bomba interrompe a entrada, mas preserva redistribuição e eliminação do fármaco remanescente.
- A hipoperfusão periférica retarda absorção IM/SC. A eliminação pondera as parcelas hepática, renal e extra-hepática de cada medicamento. A limitação de glucuronidação felina atua sobre perfis UGT, sem penalizar indiscriminadamente vias CYP.
- O paciente personalizado permite definir disfunção hepática e renal. Esses valores modificam a eliminação, sem representar um estadiamento clínico validado.
- A perfusão cerebral e renal depende também do débito cardíaco: normalizar PAM por vasoconstrição não garante restauração da oferta de oxigênio.
- A reserva compensatória depende de idade, ASA e cardiomiopatia; hipóxia e dívida de oxigênio a consomem. A recuperação é gradual, com memória de lesão e disfunção endotelial. A classificação E isolada representa urgência, sem ser tratada automaticamente como falência orgânica.
- Acidemia, hipóxia e disfunção endotelial atenuam a resposta adrenérgica. O esgotamento da reserva agrava a depressão contrátil e a perfusão, permitindo trajetórias de compensação e descompensação.
- A dose histórica acumulada deixa de ser um gatilho isolado de morte para fármacos já eliminados. A exposição atual, os receptores e a deterioração fisiológica continuam determinando toxicidade; a exposição rápida a KCl mantém seu mecanismo específico de colapso elétrico no motor.
- A lista possui filtro de emergências e reversores. Atalhos abrem a seleção para editar dose, concentração, via e, para administração IV lenta, duração. Não administram automaticamente. Taxas CRI permanecem distintas de doses em bólus; KCl está disponível somente no regime contínuo interpretável pelo editor.
- O painel de relações entre sistemas mostra reserva disponível, capacidade basal, dívida de oxigênio e estado de compensação.

## Verificação e interpretação

Os testes pareados verificam conservação de massa, proporcionalidade de exposição com a taxa, acúmulo por menor eliminação, absorção IM sob hipoperfusão, eliminação seletiva, baixo débito com PAM preservada, resposta adrenérgica reduzida, recuperação gradual e ordem de resposta às taxas de KCl nas quatro espécies.

Os testes antigos de CRI sem ataque e reversão IM foram ajustados para respeitar a entrega e a absorção. Os limites absolutos de potássio na janela curta foram substituídos por direção de resposta e uma comparação de taxas: a concentração sérica de eletrólitos ainda usa um modelo simplificado, sem balanço corporal completo.

## Fontes e limites

Os princípios de distribuição, infusão constante e eliminação dependente do paciente seguem a descrição de [farmacocinética do Merck Veterinary Manual](https://www.merckvetmanual.com/pharmacology/pharmacology-introduction/pharmacokinetics). A necessidade de considerar perfusão e condição cardiovascular durante a anestesia é consistente com as [diretrizes AAHA de fluidoterapia e anestesia em cães e gatos](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-4-fluid-therapy-and-anesthesia/); essa diretriz não valida parâmetros de bovinos e equinos.

Os coeficientes de reserva, recuperação, sensibilidade adrenérgica, perfusão, frações de eliminação e concentrações normalizadas são parâmetros educacionais. Não foram ajustados prospectivamente contra séries clínicas individuais. A degradação de Hofmann usa temperatura e dívida de oxigênio como aproximação do ambiente metabólico. Metabólitos ativos, ligação proteica e eletrólitos permanecem simplificados. Testes de software demonstram coerência do comportamento programado, não precisão preditiva clínica nem validação de doses para pacientes reais.
