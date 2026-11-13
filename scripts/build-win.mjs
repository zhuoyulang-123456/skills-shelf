#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';
const npx = isWin ? 'npx.cmd' : 'npx';

const builds = [
  {
    label: 'NSIS installer',
    args: [
      'electron-builder',
      '--win',
      'nsis',
      '--x64',
      '-c.win.artifactName=Skills-Shelf-Setup-${version}-${arch}.${ext}',
      '--publish',
      'never',
    ],
  },
  {
    label: 'portable',
    args: [
      'electron-builder',
      '--win',
      'portable',
      '--x64',
      '-c.win.artifactName=Skills-Shelf-Portable-${version}-${arch}.${ext}',
      '--publish',
      'never',
    ],
  },
];

for (const build of builds) {
  console.log(`\n=== ${build.label} ===`);
  const result = spawnSync(npx, build.args, {
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
