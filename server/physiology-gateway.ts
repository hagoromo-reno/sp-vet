import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { CanineReferenceDriver } from './canineReferenceDriver';
import { NativePhysiologyWorker } from './nativePhysiologyWorker';
import {
  CANINE_MODEL_ID,
  PHYSIOLOGY_PROTOCOL_VERSION,
  isPhysiologyClientMessage,
  type PhysiologyServerMessage,
} from '../src/physiology/protocol';

const port = Number(process.env.PHYSIOLOGY_GATEWAY_PORT || 8787);

const send = (socket: WebSocket, message: PhysiologyServerMessage): void => {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

export const createPhysiologyGateway = () => {
  const httpServer = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
        modelId: CANINE_MODEL_ID,
        nativeWorkerAvailable: NativePhysiologyWorker.configuration() !== null,
      }));
      return;
    }
    response.writeHead(404).end();
  });

  const webSocketServer = new WebSocketServer({ server: httpServer, path: '/physiology' });

  webSocketServer.on('connection', (socket) => {
    const referenceDriver = new CanineReferenceDriver();
    let nativeWorkerAvailable = false;
    const nativeWorker = new NativePhysiologyWorker(
      (message) => send(socket, message),
      (reason) => {
        nativeWorkerAvailable = false;
        send(socket, {
          type: 'error',
          protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
          code: 'NATIVE_WORKER_EXITED',
          messagePt: `O worker fisiológico foi encerrado: ${reason}`,
        });
        send(socket, {
          type: 'status',
          protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
          connected: true,
          nativeWorkerAvailable: false,
          modelId: CANINE_MODEL_ID,
          executionMode: 'shadow',
          validationGrade: 'not_validated',
          messagePt: 'Worker Pulse indisponível; o motor local continua ativo.',
        });
      }
    );
    nativeWorkerAvailable = nativeWorker.start();

    send(socket, {
      type: 'status',
      protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
      connected: true,
      nativeWorkerAvailable,
      modelId: CANINE_MODEL_ID,
      executionMode: 'shadow',
      validationGrade: 'not_validated',
      messagePt: nativeWorkerAvailable
        ? 'Gateway conectado ao worker Pulse canino experimental.'
        : 'Gateway conectado em modo de referência; worker Pulse canino indisponível.',
    });

    socket.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        send(socket, {
          type: 'error',
          protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
          code: 'INVALID_JSON',
          messagePt: 'A mensagem recebida não contém JSON válido.',
        });
        return;
      }

      if (!isPhysiologyClientMessage(parsed)) {
        send(socket, {
          type: 'error',
          protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
          code: 'INVALID_PROTOCOL_MESSAGE',
          messagePt: 'Mensagem incompatível com o protocolo fisiológico 1.0.0.',
        });
        return;
      }

      try {
        if (parsed.type === 'initialize') {
          referenceDriver.initialize(parsed.patient);
          if (nativeWorkerAvailable && nativeWorker.send(parsed)) return;
          send(socket, { type: 'ack', protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION, requestId: parsed.requestId });
        } else if (parsed.type === 'advance') {
          const referenceSnapshot = referenceDriver.advance(parsed.inputs);
          if (nativeWorkerAvailable && nativeWorker.send(parsed)) return;
          send(socket, {
            type: 'snapshot',
            protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
            requestId: parsed.requestId,
            snapshot: referenceSnapshot,
          });
        } else if (parsed.type === 'reset') {
          referenceDriver.reset();
          if (nativeWorkerAvailable && nativeWorker.send(parsed)) return;
          send(socket, { type: 'ack', protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION, requestId: parsed.requestId });
        } else {
          if (nativeWorkerAvailable && nativeWorker.send(parsed)) return;
          send(socket, { type: 'pong', protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION, requestId: parsed.requestId });
        }
      } catch (error) {
        send(socket, {
          type: 'error',
          protocolVersion: PHYSIOLOGY_PROTOCOL_VERSION,
          requestId: parsed.requestId,
          code: 'REFERENCE_DRIVER_ERROR',
          messagePt: error instanceof Error ? error.message : 'Falha desconhecida no driver de referência.',
        });
      }
    });

    socket.on('close', () => nativeWorker.stop());
  });

  return { httpServer, webSocketServer };
};

const isMainModule = process.argv[1]
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();

if (isMainModule) {
  const { httpServer } = createPhysiologyGateway();
  httpServer.listen(port, '127.0.0.1', () => {
    process.stdout.write(`Gateway fisiológico em ws://127.0.0.1:${port}/physiology\n`);
  });
}
