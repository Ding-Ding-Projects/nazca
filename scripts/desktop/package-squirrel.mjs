#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../..');
const desktopRoot = resolve(repositoryRoot, 'desktop');
const configPath = resolve(desktopRoot, 'packaging/electron-builder.yml');
const packagePath = resolve(desktopRoot, 'package.json');
const iconPath = resolve(desktopRoot, 'packaging/assets/nazca.ico');
const staticRoot = resolve(repositoryRoot, 'dist/client');
const defaultOutput = resolve(repositoryRoot, 'dist/desktop');

function fail(message) {
  console.error(`Squirrel.Windows packaging failed: ${message}`);
  process.exitCode = 1;
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function listFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(path));
    else output.push(path);
  }
  return output;
}

function assertSafeOutput(outputRoot) {
  const relativeOutput = relative(defaultOutput, outputRoot);
  if (
    relativeOutput === '..' ||
    relativeOutput.startsWith(`..${sep}`) ||
    isAbsolute(relativeOutput)
  ) {
    throw new Error(
      `--output must stay inside the repository generated desktop directory: ${defaultOutput}`,
    );
  }
  let current = defaultOutput;
  for (const segment of relativeOutput ? relativeOutput.split(sep) : []) {
    current = join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`--output cannot traverse a symbolic link: ${current}`);
    }
  }
  if (existsSync(defaultOutput) && lstatSync(defaultOutput).isSymbolicLink()) {
    throw new Error(
      `generated desktop directory cannot be a symbolic link: ${defaultOutput}`,
    );
  }
}

function assertConfigText(configText) {
  const required = [
    'forceCodeSigning: false',
    'signExecutable: false',
    'signAndEditExecutable: false',
    'target: squirrel',
    'msi: false',
    'iconUrl: https://raw.githubusercontent.com/Ding-Ding-Projects/nazca/main/desktop/packaging/assets/nazca.ico',
    'from: ../dist/client',
    'to: site',
  ];
  for (const line of required) {
    if (!configText.includes(line))
      throw new Error(`packaging config is missing ${line}`);
  }
}

function assertDesktopDependencies(desktopPackage) {
  const expected = {
    electron: '43.0.0',
    'electron-builder': '26.15.3',
    'electron-builder-squirrel-windows': '26.15.3',
  };
  for (const [name, version] of Object.entries(expected)) {
    const declared =
      desktopPackage.devDependencies?.[name] ??
      desktopPackage.dependencies?.[name];
    if (declared !== version) {
      throw new Error(
        `desktop/package.json must declare ${name}@${version}, found ${declared ?? 'missing'}`,
      );
    }
  }
}

function assertIcon(path) {
  const bytes = readFileSync(path);
  if (
    bytes.length < 6 ||
    bytes.readUInt16LE(0) !== 0 ||
    bytes.readUInt16LE(2) !== 1
  ) {
    throw new Error(`desktop icon is not a valid ICO file: ${path}`);
  }
  const count = bytes.readUInt16LE(4);
  if (count < 3 || bytes.length < 6 + count * 16) {
    throw new Error(
      `desktop icon must contain at least three complete resolutions: ${path}`,
    );
  }
  const sizes = new Set();
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    const width = bytes[offset] || 256;
    const height = bytes[offset + 1] || 256;
    if (width !== height || width < 16)
      throw new Error(
        `desktop icon contains an invalid resolution: ${width}x${height}`,
      );
    sizes.add(width);
  }
  if (sizes.size < 3)
    throw new Error(
      `desktop icon must contain three distinct resolutions, found ${[...sizes].join(', ')}`,
    );
}

function assertUnsigned(path) {
  if (process.platform !== 'win32') {
    throw new Error(
      'Squirrel.Windows packaging must run on Windows so Authenticode status can be checked',
    );
  }
  const bytes = readFileSync(path);
  if (bytes.length < 0x40 || bytes.toString('ascii', 0, 2) !== 'MZ')
    throw new Error(`Setup.exe is not a PE image: ${path}`);
  const peOffset = bytes.readUInt32LE(0x3c);
  if (peOffset + 24 > bytes.length || bytes.toString('ascii', peOffset, peOffset + 4) !== 'PE\u0000\u0000')
    throw new Error(`Setup.exe has an invalid PE header: ${path}`);
  const optionalOffset = peOffset + 24;
  const magic = bytes.readUInt16LE(optionalOffset);
  const dataDirectoryOffset = magic === 0x10b ? optionalOffset + 96 : magic === 0x20b ? optionalOffset + 112 : 0;
  if (!dataDirectoryOffset || dataDirectoryOffset + 40 > bytes.length)
    throw new Error(`Setup.exe has an unsupported PE optional header: ${path}`);
  const certificateAddress = bytes.readUInt32LE(dataDirectoryOffset + 8 * 4);
  const certificateSize = bytes.readUInt32LE(dataDirectoryOffset + 8 * 4 + 4);
  if (certificateAddress !== 0 || certificateSize !== 0)
    throw new Error(`Setup.exe contains an Authenticode certificate table (address=${certificateAddress}, size=${certificateSize}): ${path}`);
}

function validateNupkg(path) {
  if (statSync(path).size <= 0) throw new Error(`empty nupkg: ${path}`);
  if (process.platform !== 'win32') return;
  const probe = `& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${path.replaceAll("'", "''")}'); try { $names=$z.Entries.FullName; if (-not ($names -match '\\.nuspec$')) { exit 2 }; if (-not ($names -match 'resources/site/index\\.html$')) { exit 3 } } finally { $z.Dispose() } }`;
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', probe],
    { stdio: 'ignore' },
  );
}

function validatePackagedSite(path) {
  if (process.platform !== 'win32') return;
  const probe = `& { Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead('${path.replaceAll("'", "''")}'); try { $names=$z.Entries.FullName; if (-not ($names | Where-Object { $_.Contains('resources/site/index.html') })) { exit 3 }; if (-not ($names | Where-Object { $_.Contains('resources/site/provenance.json') })) { exit 4 } } finally { $z.Dispose() } }`;
  execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', probe],
    { stdio: 'ignore' },
  );
}

if (process.platform !== 'win32') {
  fail('the Squirrel.Windows contract is Windows-only');
} else if (!existsSync(packagePath)) {
  fail(`missing desktop runtime manifest at ${packagePath}`);
} else if (!existsSync(configPath)) {
  fail(`missing packaging config at ${configPath}`);
} else {
  try {
    const desktopPackage = JSON.parse(readFileSync(packagePath, 'utf8'));
    if (
      !desktopPackage.version ||
      !desktopPackage.name ||
      !desktopPackage.main
    ) {
      throw new Error(
        'desktop/package.json must provide name, version, and main',
      );
    }
    assertDesktopDependencies(desktopPackage);
    const configText = readFileSync(configPath, 'utf8');
    assertConfigText(configText);
    if (!existsSync(iconPath))
      throw new Error(`desktop icon is missing at ${iconPath}`);
    assertIcon(iconPath);
    for (const filename of ['index.html', 'provenance.json']) {
      if (!existsSync(join(staticRoot, filename)))
        throw new Error(
          `static export is missing at ${join(staticRoot, filename)}`,
        );
    }

    const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim();
    const outputRoot = resolve(
      repositoryRoot,
      argValue('--output', defaultOutput),
    );
    assertSafeOutput(outputRoot);
    const squirrelOutput = join(outputRoot, 'squirrel-windows');
    if (
      existsSync(squirrelOutput) &&
      lstatSync(squirrelOutput).isSymbolicLink()
    ) {
      throw new Error(
        `generated Squirrel output cannot be a symbolic link: ${squirrelOutput}`,
      );
    }
    rmSync(squirrelOutput, { recursive: true, force: true });
    mkdirSync(squirrelOutput, { recursive: true });

    const localBuilder = resolve(
      desktopRoot,
      'node_modules/.bin/electron-builder.cmd',
    );
    const workspaceBuilder = resolve(
      repositoryRoot,
      'node_modules/.bin/electron-builder.cmd',
    );
    const builder = existsSync(localBuilder) ? localBuilder : workspaceBuilder;
    if (!existsSync(builder))
      throw new Error(
        'electron-builder is not installed in desktop or the workspace; install the pinned desktop dependency first',
      );

    const builderIsCmd = builder.toLowerCase().endsWith('.cmd');
    const builderJs = resolve(
      builder.startsWith(desktopRoot)
        ? desktopRoot
        : repositoryRoot,
      'node_modules/electron-builder/out/cli/cli.js',
    );
    const builderCommand = builderIsCmd && existsSync(builderJs) ? process.execPath : builder;
    const builderArguments = builderCommand === process.execPath
      ? [builderJs, '--config', configPath, '--win', 'squirrel']
      : ['--config', configPath, '--win', 'squirrel'];
    const result = spawnSync(
      builderCommand,
      builderArguments,
      {
        cwd: desktopRoot,
        env: {
          ...process.env,
          CSC_IDENTITY_AUTO_DISCOVERY: 'false',
          CSC_LINK: '',
          WIN_CSC_LINK: '',
        },
        stdio: 'inherit',
        shell: false,
      },
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(`electron-builder exited with ${result.status}`);

    const files = listFiles(squirrelOutput);
    const setup = files.find((path) =>
      path.toLowerCase().endsWith('setup.exe'),
    );
    const releases = files.find((path) =>
      path.toLowerCase().endsWith('releases'),
    );
    const fullNupkg = files.find(
      (path) =>
        path.toLowerCase().endsWith('.nupkg') &&
        !path.toLowerCase().endsWith('.delta.nupkg'),
    );
    if (!setup) throw new Error(`Setup.exe is missing from ${squirrelOutput}`);
    if (!releases)
      throw new Error(`RELEASES is missing from ${squirrelOutput}`);
    if (!fullNupkg)
      throw new Error(`full .nupkg is missing from ${squirrelOutput}`);
    assertUnsigned(setup);
    validateNupkg(fullNupkg);
    validatePackagedSite(fullNupkg);

    const manifest = {
      schemaVersion: 1,
      sourceCommit,
      packageName: desktopPackage.name,
      version: desktopPackage.version,
      generatedAt: new Date().toISOString(),
      signing: {
        forceCodeSigning: false,
        signAndEditExecutable: false,
        status: 'NotSigned',
      },
      files: files.map((path) => ({
        name: path.slice(squirrelOutput.length + 1).replaceAll('\\', '/'),
        bytes: statSync(path).size,
        sha256: sha256(path),
      })),
    };
    writeFileSync(
      join(squirrelOutput, 'release-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    console.log(
      `Squirrel.Windows package validated for ${desktopPackage.name} ${desktopPackage.version}`,
    );
    console.log(`Source commit: ${sourceCommit}`);
    console.log(`Output: ${squirrelOutput}`);
    console.log('Signing: disabled, Setup.exe status NotSigned');
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
