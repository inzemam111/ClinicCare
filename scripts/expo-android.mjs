import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const sdkCandidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
].filter(Boolean);

const sdkRoot = sdkCandidates.find((candidate) =>
  existsSync(join(candidate, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')),
);

if (!sdkRoot) {
  console.error('Android SDK platform-tools were not found. Install them with Android Studio first.');
  process.exit(1);
}

const platformTools = join(sdkRoot, 'platform-tools');
const adb = join(platformTools, process.platform === 'win32' ? 'adb.exe' : 'adb');
const adbDevices = spawnSync(adb, ['devices'], { encoding: 'utf8' });
const deviceIds = (adbDevices.stdout ?? '')
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.trim().split(/\s+/))
  .filter(([, state]) => state === 'device')
  .map(([id]) => id);

const hasReverseTunnel = deviceIds.some((deviceId) => {
  const result = spawnSync(
    adb,
    ['-s', deviceId, 'reverse', 'tcp:3000', 'tcp:3000'],
    { stdio: 'ignore' },
  );
  return result.status === 0;
});

const lanAddress = Object.entries(networkInterfaces())
  .filter(([name]) => !/(docker|vethernet|wsl|virtual|vmware|hyper-v|loopback)/i.test(name))
  .flatMap(([, addresses]) => addresses ?? [])
  .find((address) => address.family === 'IPv4' && !address.internal)?.address;
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;
const configuredForDevice =
  configuredApiUrl && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(configuredApiUrl)
    ? configuredApiUrl
    : undefined;
const apiUrl =
  configuredForDevice ??
  (hasReverseTunnel
    ? 'http://127.0.0.1:3000/api/v1'
    : lanAddress
      ? `http://${lanAddress}:3000/api/v1`
      : 'http://localhost:3000/api/v1');

const env = {
  ...process.env,
  ANDROID_HOME: sdkRoot,
  ANDROID_SDK_ROOT: sdkRoot,
  EXPO_PUBLIC_API_URL: apiUrl,
  PATH: `${platformTools}${delimiter}${process.env.PATH ?? ''}`,
};

console.log(`Using ClinicCare API at ${apiUrl}`);

const requireFromApp = createRequire(join(process.cwd(), 'package.json'));
const expoCli = join(dirname(requireFromApp.resolve('expo/package.json')), 'bin', 'cli');
const child = spawn(process.execPath, [expoCli, 'start', '--android', ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
