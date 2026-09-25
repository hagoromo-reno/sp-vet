# Revisão da interface

A interface foi organizada por tarefa: acompanhar o paciente, intervir e consultar detalhes. O motor fisiológico, os cálculos de dose e os manipuladores das intervenções foram preservados.

## Organização

- Cabeçalho: identidade da aplicação, relógio, pausa, velocidade, reinício e acesso direto à emergência.
- Contexto do paciente: seleção de cenário, consciência, biofísica, eventos e ocorrências, com rótulos visíveis também no celular.
- Monitorização: curvas e sinais vitais com largura dedicada; controles de áudio, pressão e via aérea continuam disponíveis.
- Telemetria: painel expansível com os três modos originais — fármacos, biofísica e biotransformação. Recolher o painel mantém seu estado.
- Intervenções: medicamentos, anestesia e ventilação, exame físico, fluidos e temperatura, emergência e ficha anestésica. Um resumo fixo de sinais vitais acompanha a rolagem dentro dessa seção.
- Farmacopeia: busca com rótulo, filtro de categoria, estado vazio com limpeza de filtros e atalhos de emergência/reversores em uma seção expansível. A seleção continua separada da administração.

## Critérios de design

Superfícies neutras, espaçamento consistente, contraste entre títulos e informações secundárias e uma cor de seleção para navegação. As cores clínicas dos sinais vitais e alertas foram mantidas. Os dados detalhados continuam acessíveis, mas deixam de competir com a leitura inicial.

Abas com semântica acessível, seleção por setas/Home/End, foco visível e botões de medicamento utilizáveis pelo teclado. O histórico fechado fica inerte. Há link de salto para intervenções e respeito à preferência de movimento reduzido nas animações da interface.

## Verificação

- TypeScript sem erros e build de produção concluído.
- 112 testes existentes aprovados.
- Navegação pelas seis áreas e troca de aba por teclado verificadas no navegador.
- Busca sem resultados, limpeza de filtros, categoria e seleção de medicamento verificadas.
- Administração em sessão simulada confirmada na lista de doses e na telemetria.
- Revisão visual em desktop e celular de 390 px, com verificação de largura da página.

O build ainda avisa sobre o tamanho do pacote JavaScript, acima de 500 kB. A revisão visual e os testes de navegação não equivalem a uma auditoria completa de acessibilidade nem à revalidação clínica de todos os cenários.
