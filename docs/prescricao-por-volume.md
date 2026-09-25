# Prescrição por frasco e volume

O aluno seleciona o fármaco e a apresentação e informa mL (bólus) ou mL/h (CRI). O volume inicial corresponde à média aritmética entre mínimo e máximo do regime da espécie, não à dose típica. Trocar apresentação, espécie, peso ou modo recalcula esse ponto inicial. As faixas são informativas: volumes acima delas continuam permitidos para experimentos e acionam os avisos existentes.

As quantidades são convertidas para a unidade usada pelo motor. Fentanila a 50 mcg/mL equivale a 0,05 mg/mL; taxas em mcg/kg/min são convertidas para mL/h com o fator 60. Eletrólitos conservam mEq e soluções dosadas em volume conservam mL, sem atribuir uma massa fictícia ao sangue ou ao Ringer.

Há 12 apresentações comerciais para sete fármacos: acepromazina, dexmedetomidina, midazolam, propofol, xilazina, fentanila e flumazenil. As fontes dos fabricantes estão em `src/data/drugFormulations.ts` e acessíveis na interface. Os demais medicamentos continuam com a preparação de referência do simulador, explicitamente identificada. Apresentação comercial não implica indicação aprovada em todas as espécies ou vias do catálogo; as faixas do motor continuam sujeitas à revisão dos anestesiologistas.

Cada administração conserva identificação, concentração, unidade do rótulo, tamanho de frasco quando verificado e fonte. Esses dados acompanham doses, eventos de auditoria, instantâneos por minuto e arquivos exportados para revisão. O tamanho do frasco informa a quantidade de frascos necessária, mas não controla estoque. Esta versão não calcula diluição, compatibilidade de diluentes ou reconstituição personalizada.

Validação: testes de conversão para todos os regimes e apresentações disponíveis em CAN/FEL/BOV/EQUI; equivalência entre mg/mcg; CRI por minuto/hora; concentrações inválidas. Conferência no navegador: em um canino de 28,5 kg, a média de acepromazina de 0,855 mg corresponde a 0,4275 mL (2 mg/mL) e 0,0855 mL (10 mg/mL).
