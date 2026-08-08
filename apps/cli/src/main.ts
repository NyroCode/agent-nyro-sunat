#!/usr/bin/env node

import { runCli, type CliIo } from "./cli.js";
import { LocalCliServices } from "./services.js";

const io: CliIo = {
  writeOut(message: string): void {
    process.stdout.write(`${message}\n`);
  },
  writeError(message: string): void {
    process.stderr.write(`${message}\n`);
  },
};

process.exitCode = await runCli(process.argv.slice(2), new LocalCliServices(), io);
