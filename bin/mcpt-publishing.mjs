#!/usr/bin/env node
import { run } from "../src/cli/router.mjs";
run(process.argv).catch(e => { process.stderr.write('Fatal: ' + (e?.message ?? e) + '\n'); process.exit(1); });
