# SimPet — investigação de hipotensão e taquicardia

## Problema reproduzido

Investigação motivada por hipotensão excessiva em associações simples, posteriormente especificadas como dexmedetomidina + metadona + propofol. Como doses, via, espécie e cenário do episódio não foram informados, os experimentos usam pacientes padronizados, não uma reconstrução exata do episódio.

O script `scripts/audit-hemodynamics.ts` compara fármacos isolados e associações em cães e gatos ASA I, sem estímulo doloroso, com intubação traqueal, ventilação por volume e aquecimento. As doses típicas do catálogo são administradas em 60 segundos. Observação: 15 minutos; os testes de regressão também cobrem 30 minutos e pré-medicação IM seguida de indução gradual.

## Causas encontradas e correções

1. **Duplicação de efeitos:** vetores genéricos de FC/PAM eram somados aos efeitos dos receptores responsáveis pela mesma observação. Agora, esses vetores são usados apenas quando não existe mecanismo cardiovascular explícito. Nitroprussiato mantém separadamente sua ação arterial e venosa; hidralazina permanece predominantemente arterial.
2. **Vagotonia tratada como falência ventricular:** a ativação opioide reduzia FC por M2 e era novamente aplicada ao cálcio ventricular por M2 e mu. A contribuição ventricular indireta foi reduzida e a duplicação de mu removida. A bradicardia continua podendo reduzir o débito.
3. **Enchimento diastólico incompleto:** havia penalidade de enchimento na taquicardia, mas nenhuma compensação limitada de volume sistólico quando a diástole se prolongava. A nova compensação depende de pré-carga e não repõe sangue perdido ou normaliza um ventrículo doente.
4. **Desequilíbrio alfa-2:** a vasoconstrição estava pequena diante da redução nodal e ventricular combinada. Foi recalibrada preservando baixo débito, bradicardia e interação desfavorável com bloqueio vagal.
5. **Hipoperfusão regional convertida em anóxia global:** o pior índice renal/hepático acumulava dívida global de oxigênio, capaz de acionar AESP mesmo com oferta sistêmica suficiente. A dívida global agora depende da insuficiência sistêmica de entrega ou de hipoperfusão cerebral profunda. Os índices regionais continuam afetando depuração e sinais de lesão orgânica.
6. **Taquicardia antimuscarínica sem reserva finita:** associações de bloqueadores muscarínicos somavam bloqueio além de 100%. Agora o bloqueio compartilhado satura, independe da ordem de administração e a resposta cronotrópica considera tônus vagal da espécie, FC basal e estímulo simpático.
7. **Poupança de MAC aplicada ao coração:** a concentração equivalente para hipnose amplificava depressão miocárdica do inalatório; além disso havia duas contribuições de depressão ventricular. Agora a contribuição cardíaca é calculada uma vez a partir da exposição efetivamente recebida. O sinergismo hipnótico permanece.

## Comparações observadas no simulador

Paciente canino padronizado de 20 kg, FC basal 90 bpm e PAM basal 78 mmHg, doses típicas IV lentas, com suporte acima:

| Experimento | Antes | Depois |
| --- | ---: | ---: |
| Metadona: PAM mínima | 57,0 mmHg | 71,3 mmHg |
| Acepromazina + metadona: PAM mínima | 49,0 mmHg | 61,9 mmHg |
| Atropina + cetamina: FC máxima | 142,8 bpm | 116,8 bpm |
| Dexmedetomidina isolada: evolução em 15 min | Parada artificial por dívida global | Sem parada |

Dexmedetomidina 5 µg/kg + metadona 0,3 mg/kg + propofol 4 mg/kg, todos iniciados juntos e entregues em 60 s, apresentaram PAM mínima de aproximadamente **61,3 mmHg** no cão e **60,3 mmHg** no gato (doses típicas felinas do catálogo). A FC e o débito diminuem, mas o paciente não entra automaticamente em colapso. Esses valores são resultados do simulador, não metas ou previsões clínicas.

Também foi testado o esquema canino de dexmedetomidina 2 µg/kg e metadona 0,3 mg/kg IM, seguido 20 minutos depois de propofol 2 mg/kg em 120 s. A comparação com estudo clínico abaixo é qualitativa: o trabalho titula propofol ao efeito e não estabelece essa dose fixa para todos os pacientes.

## Rastreabilidade na interface

Em **Biofísica → Relações entre sistemas → Entender a FC e a pressão deste paciente**, a interface mostra pré-carga, resistência vascular, contratilidade, débito e contribuições para o alvo de FC: ação nodal, barorreflexo, respostas sistêmicas e outros ajustes. Os termos recompõem o alvo; o monitor apresenta a resposta suavizada no tempo. Durante PCR, prevalece o estado de reanimação.

## Evidência e limites

- [Souza et al., 2025 — ensaio clínico de pré-medicação e propofol gradual](https://pubmed.ncbi.nlm.nih.gov/41036360/): cães hígidos, acepromazina/metadona ou dexmedetomidina/metadona IM; propofol a 1 mg/kg/min titulado ao efeito. Sustenta diferenciar protocolo gradual de administração excessiva. Não houve hipotensão nesse estudo.
- [Hemodinâmica de acepromazina/dexmedetomidina sob propofol e isoflurano](https://pubmed.ncbi.nlm.nih.gov/25794125/): acepromazina pode agravar hipotensão sob anestesia; portanto essa possibilidade permanece no motor.
- [Metadona em cães hígidos, três doses IM](https://pubmed.ncbi.nlm.nih.gov/24118948/): sustenta bradicardia dose/contexto dependente, sem equiparar automaticamente vagotonia à falência ventricular.
- [Dexmedetomidina em coração canino isolado](https://pubmed.ncbi.nlm.nih.gov/1353991/) e [hemodinâmica sistêmica em cães](https://pubmed.ncbi.nlm.nih.gov/9713732/): sustentam separar efeitos nodais, carga vascular e contratilidade, com diferenças temporais e de preparação experimental.
- [Cetamina-midazolam em cães](https://pubmed.ncbi.nlm.nih.gov/8250397/): aumento de FC pode ocorrer; o objetivo não é eliminar taquicardia farmacológica.
- [FC e variabilidade em gatos em casa e no hospital](https://pmc.ncbi.nlm.nih.gov/articles/PMC10832729/): sustenta a influência do contexto autonômico sobre a FC, sem validar numericamente os coeficientes de vagólise adotados.

As constantes continuam sendo calibrações educacionais, sem validação clínica quantitativa. Espécie, reserva, dose, via, velocidade, ventilação e volemia continuam alterando a trajetória. Não foram impostos pisos normais de PAM ou FC, nem removidos estados de choque, arritmia e parada. Testes negativos confirmam piora com hipovolemia, indução excessiva rápida e oferta sistêmica crítica de oxigênio.

A regressão de fluidos passou a exigir melhora tanto de PAM quanto de débito em comparação pareada, em vez de um aumento fixo de 5 mmHg que dependia da deterioração artificial do controle. A suíte inclui 136 testes e a auditoria farmacológica cobre 489 casos. No ambiente Windows, o lançador `tsx` apresentou `uv_os_get_passwd ENOMEM`; os testes também foram executados via esbuild + `node --test`, preservando `import.meta.url` por módulo para o teste do gateway.
