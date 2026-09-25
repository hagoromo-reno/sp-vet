# Áudio do monitor

Revisão de setembro de 2026. O pulso mantém sua síntese, duração e escala de SpO₂. Os alarmes têm configuração independente.

Fontes consultadas:

- [Philips PIC iX, capítulo 6, páginas 6-4 e 6-5](https://www.documents.philips.com/assets/Instruction%20for%20Use/20220825/21bcadb8ecbd4baa8945aefc00f3c37f.pdf): o modo tradicional repete o alerta vermelho agudo a cada segundo e o amarelo grave a cada dois segundos; o modo ISO/IEC usa grupos de cinco e três tons, respectivamente.
- [Exemplos de alarmes de Chris Thompson](https://th.id.au/alarms/): referência histórica de rajadas de alta prioridade, com dois grupos de cinco pulsos e dois segundos de silêncio entre grupos. A página também esclarece que tons musicais são permitidos.

O perfil padrão usa grupos 3+2, repetidos após dois segundos de silêncio, totalizando 4,6 s; o ciclo começa a cada 8 s. Atenção usa três pulsos em 1,15 s, com ciclo de 10 s. Os intervalos entre ciclos são escolhas do simulador. O perfil tradicional usa a cadência documentada pela Philips.

Frequências, amplitudes relativas e quatro harmônicos são escolhas de síntese do SimPet, não medições de um equipamento. Há ataque de 12 ms e liberação de 25 ms, evitando o envelope quase instantâneo e a ressonância forte do antigo buzzer. Não houve escuta direta ou validação perceptiva contra gravações; não se alega certificação IEC ou reprodução exata de marca/modelo. As referências fundamentam os ritmos, não a fidelidade acústica.

Assistolia agora usa o alerta crítico selecionado. Silenciar, pausar a simulação, resolver a condição ou reiniciar interrompe os alarmes agendados. Uma mudança de prioridade substitui a sequência anterior imediatamente. A cadência usa tempo real, independente da velocidade da simulação. O contador de silenciamento mantém o comportamento anterior em tempo simulado.

Os testes de interface tocam uma sequência e respeitam silenciamento/volume. O botão de parada e o fechamento do painel cancelam a prévia. Um alarme clínico pode interromper a prévia. Os limites clínicos e os sons do desfibrilador não foram alterados.
