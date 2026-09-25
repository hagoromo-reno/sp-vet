# SimPet: escopolamina e fluidoterapia

## Medicamentos distintos

O butilbrometo de escopolamina atua predominantemente em M2/M3 periféricos. O motor conecta o bloqueio à frequência cardíaca, secreções, motilidade intestinal e retenção urinária. Sua associação com alfa-2 também passa pelo mecanismo existente de demanda miocárdica/pós-carga. Não recebe analgesia cirúrgica, hipnose ou bloqueio neuromuscular artificiais.

O bromidrato de escopolamina acrescenta ação M1 central, alteração cognitiva, sonolência e excitação em exposição elevada. Depressores centrais e opioides modificam a resposta; efeitos digestivos podem somar-se aos de opioides/alfa-2. Ambos utilizam exposição, eliminação e recuperação temporal do motor.

Os regimes são limitados às espécies e vias documentadas. Para o butilbrometo: equino IV lento, bovino IV lento e canino IV lento com evidência piloto limitada. Para o bromidrato: canino SC e felino IM, explicitamente identificados como referências experimentais, sem extrapolação para equinos/bovinos. A apresentação simples de butilbrometo não contém dipirona.

Fontes consultadas em 08/09/2026:

- [FDA/DailyMed: Buscopan, bula equina](https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=858926e9-457e-47c2-b7c4-2d1c6bb13ea8): dose, administração lenta, taquicardia e redução transitória dos ruídos intestinais.
- [VMD: Spasmipur, resumo das características](https://www.vmd.defra.gov.uk/productinformationdatabase/files/QRD_Documents/QRD-Auth_1606030.PDF): regimes em equinos/bovinos.
- [CBAV: estudo piloto canino](https://publicacoes.cbav.org.br/cbav/article/view/136): evidência preliminar, amostra pequena.
- [Estudo experimental canino, PMID 15029470](https://pubmed.ncbi.nlm.nih.gov/15029470/): escopolamina SC e alteração cognitiva.
- [Estudo experimental felino, PMID 3434920](https://pubmed.ncbi.nlm.nih.gov/3434920/): bromidrato IM.
- [Health Canada: apresentação injetável](https://health-products.canada.ca/dpd-bdpp/info?code=66635&lang=eng): concentração de 0,4 mg/mL; não usada para extrapolar posologia veterinária.
- [Interação equina com medetomidina, PMID 24576304](https://pubmed.ncbi.nlm.nih.gov/24576304/).

## Entrega e efeitos dos fluidos

A bomba entrega taxa × tempo. Cada bólus conserva sua solução, volume, duração e progresso, permite interrupção/retomada e termina sem ultrapassar o volume programado. Bomba e bólus simultâneos somam a entrega real; fluidos administrados pelo catálogo usam o mesmo balanço, sem bônus de pressão calculado pela concentração farmacológica.

O volume adicional distribui-se entre circulação e interstício, com remoção renal dependente de perfusão, função renal, congestão e glicemia. A hipovolemia modifica retenção; sepse aumenta extravasamento; cardiopatia reduz tolerância. A hemodinâmica existente converte pré-carga e congestão em débito/PAM e respostas compensatórias de FC. Edema pulmonar prejudica trocas gasosas. O efeito persiste após interromper a entrega e se resolve gradualmente.

Soluções diferem pela carga de sódio, cloreto, glicose, recrutamento osmótico e eritrócitos. Glicose entra no metabolismo em massa por tempo; salina pode acrescentar acidose hiperclorêmica; sangue altera hematócrito por balanço de massa; hipertônica expande transitoriamente sem repor eritrócitos. A temperatura e o volume efetivamente entregues participam do balanço térmico.

Base clínica: [AAHA 2024, reposição e manutenção](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-3-fluids-for-replacement-and-maintenance/), [pacientes enfermos](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-5-fluid-therapy-in-ill-patients/) e [sobrecarga](https://www.aaha.org/resources/2024-aaha-fluid-therapy-guidelines-for-dogs-and-cats/section-6-fluid-overload/). Essas diretrizes sustentam a individualização por composição, velocidade, resposta e tolerância; não validam os coeficientes numéricos deste simulador.

## Limites e verificação

Este é um modelo educacional, ainda sem validação clínica quantitativa. Afinidades, constantes de redistribuição/eliminação, cinética central, limiares de congestão e índices de motilidade são calibrações do simulador, não parâmetros clínicos medidos para todas as espécies. Particularmente, a meia-vida radioativa da bula do butilbrometo não foi tratada como meia-vida do fármaco parental.

O balanço acompanha volume **adicional** infundido; sua depuração hídrica não representa diurese basal total. Água recrutada osmoticamente é endógena e fica separada da conservação do volume administrado. Eletrólitos/acidose são aproximações, sem modelo completo de osmolaridade, potássio ou equilíbrio ácido-base por íon forte. Sangue usa hematócrito fixo do doador de 40%; compatibilidade transfusional, coagulação e todas as reações adversas não são reproduzidas pelo novo módulo. Coloides não recebem, por sua disponibilidade na interface, recomendação clínica de uso.

Os testes cobrem entrega, pausa/retomada, conservação de volume, sensibilidade à taxa e ao passo temporal, hipovolemia, sepse, disfunção renal, cardiopatia, edema, glicose, cloreto/pH, hipertônica, sangue, temperatura, diferenças entre as escopolaminas, vias por espécie e interação com alfa-2. Expectativas antigas de aumento fixo de pressão/hematócrito foram substituídas por retenção temporal e balanço de eritrócitos. A suíte completa contém 126 testes.
