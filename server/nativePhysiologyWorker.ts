import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import type { PhysiologyClientMessage, PhysiologyServerMessage } from '../src/physiology/protocol';

type MessageHandler = (message: PhysiologyServerMessage) => void;
type ExitHandler = (reason: string) => void;

const resolveExecutable = (candidate: string): string | null => {
  const extensions = process.platform === 'win32' && !candidate.toLowerCase().endsWith('.exe')
    ? ['', '.exe', '.cmd', '.bat']
    : [''];
  for (const extension of extensions) {
    const direct = resolve(`${candidate}${extension}`);
    if (existsSync(direct)) return direct;
  }

  for (const directory of (process.env.PATH || '').split(delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const fullPath = resolve(directory, `${candidate}${extension}`);
      if (existsSync(fullPath)) return fullPath;
    }
  }
  return null;
};

interface WorkerLaunch {
  command: string;
  args: string[];
  dataDirectory: string;
}

/**
 * One worker process is created per WebSocket session. This preserves Pulse's
 * one-engine-per-patient ownership and prevents state leaking between cases.
 * The worker protocol is newline-delimited JSON over stdio; networking remains
 * in this small gateway instead of the scientific C++ process.
 */
export class NativePhysiologyWorker {
  private process: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = '';

  public constructor(
    private readonly onMessage: MessageHandler,
    private readonly onExit: ExitHandler
  ) {}

  public static configuration(): WorkerLaunch | null {
    if (process.env.PULSE_CANINE_DISABLE_NATIVE === '1') return null;
    const configured = process.env.PULSE_CANINE_WORKER;
    if (configured) {
      const executable = resolveExecutable(configured);
      return executable ? {
        command: executable,
        args: [],
        dataDirectory: process.env.PULSE_DATA_DIR || 'C:\\Code2\\synth-engine\\build-canino\\install\\bin',
      } : null;
    }

    // Development fallback: run the Linux worker built by the reproducible
    // Docker toolchain while keeping stdio attached to this gateway process.
    const installDirectory = process.env.PULSE_CANINE_INSTALL_DIR
      || 'C:\\Code2\\synth-engine\\build-canino\\install';
    const linuxWorker = join(installDirectory, 'bin', 'PulseCanineWorker');
    const docker = resolveExecutable('docker');
    if (!docker || !existsSync(linuxWorker)) return null;

    return {
      command: docker,
      args: [
        'run', '--rm', '-i', '--network', 'none',
        '-v', `${installDirectory}:/custom:ro`,
        '-w', '/pulse/bin',
        '-e', 'PULSE_DATA_DIR=/pulse/bin',
        process.env.PULSE_CANINE_DOCKER_IMAGE || 'open-vetsim/pulse-canine-runtime:4.3.1-data-bookworm',
        '/custom/bin/PulseCanineWorker',
      ],
      dataDirectory: '/pulse/bin',
    };
  }

  public start(): boolean {
    const launch = NativePhysiologyWorker.configuration();
    if (!launch) return false;

    this.process = spawn(launch.command, launch.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: {
        ...process.env,
        PULSE_DATA_DIR: launch.dataDirectory,
      },
    });

    this.process.stdout.setEncoding('utf8');
    this.process.stdout.on('data', (chunk: string) => this.consumeStdout(chunk));
    this.process.stderr.setEncoding('utf8');
    this.process.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) process.stderr.write(`[pulse-canino] ${text}\n`);
    });
    this.process.on('error', (error) => this.onExit(error.message));
    this.process.on('exit', (code, signal) => {
      this.process = null;
      this.onExit(`worker encerrado (código ${code ?? 'n/a'}, sinal ${signal ?? 'n/a'})`);
    });
    return true;
  }

  public send(message: PhysiologyClientMessage): boolean {
    if (!this.process || !this.process.stdin.writable) return false;
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
    return true;
  }

  public stop(): void {
    if (!this.process) return;
    this.process.stdin.end();
    this.process.kill('SIGTERM');
    this.process = null;
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) {
        try {
          this.onMessage(JSON.parse(line) as PhysiologyServerMessage);
        } catch {
          this.onExit('worker produziu uma mensagem JSON inválida');
        }
      }
      newline = this.stdoutBuffer.indexOf('\n');
    }
  }
}
