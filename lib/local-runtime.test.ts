import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZipArchive } from './zip-builder';
import {
  buildScrcpyArgs,
  isAllowedLocalBridgeUrl,
  isValidAdbSerial,
  isValidWirelessHostPort,
  parseAdbDevicesOutput,
  sanitizeExecutablePath,
} from './local-adb';
import { generateWindowsAgentBundle } from './python-exporter';
import { generateScrcpyBridgeBundle } from './scrcpy-bridge-exporter';
import { DEFAULT_APP_SETTINGS, DEFAULT_WORKFLOW_PROFILE } from './mock-device';

test('buildZipArchive generates valid PKZIP header and includes all Windows bundle files', () => {
  const bundle = generateWindowsAgentBundle(
    DEFAULT_WORKFLOW_PROFILE,
    DEFAULT_APP_SETTINGS
  );
  assert.ok(bundle.length >= 16, `Expected at least 16 files, got ${bundle.length}`);

  const requiredPaths = [
    'grab-desktop-agent/README.md',
    'grab-desktop-agent/run_windows.bat',
    'grab-desktop-agent/build_exe.bat',
    'grab-desktop-agent/main.py',
    'grab-desktop-agent/app/ui/main_window.py',
    'grab-desktop-agent/app/automation/state_machine.py',
    'grab-desktop-agent/config/workflow_profile.json',
    'grab-desktop-agent/config/app_settings.json',
  ];
  for (const req of requiredPaths) {
    assert.ok(
      bundle.some((f) => f.path === req),
      `Missing required file in Windows bundle: ${req}`
    );
  }

  const zipBytes = buildZipArchive(
    bundle.map((f) => ({ path: f.path, content: f.content }))
  );

  // PKZIP local file header signature ("PK\x03\x04")
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);

  const eocdOffset = zipBytes.length - 22;
  assert.equal(zipBytes[eocdOffset], 0x50);
  assert.equal(zipBytes[eocdOffset + 1], 0x4b);
  assert.equal(zipBytes[eocdOffset + 2], 0x05);
  assert.equal(zipBytes[eocdOffset + 3], 0x06);

  const entryCount = zipBytes[eocdOffset + 10] | (zipBytes[eocdOffset + 11] << 8);
  assert.equal(entryCount, bundle.length);
});

test('generateScrcpyBridgeBundle creates standalone zero-dep bridge files', () => {
  const files = generateScrcpyBridgeBundle(DEFAULT_APP_SETTINGS);
  assert.equal(files.length, 3);
  assert.ok(files.some((f) => f.path.endsWith('scrcpy_bridge.py')));
  assert.ok(files.some((f) => f.path.endsWith('start_scrcpy_bridge.bat')));
  const zipBytes = buildZipArchive(files.map((f) => ({ path: f.path, content: f.content })));
  assert.equal(zipBytes[0], 0x50);
  assert.equal(zipBytes[1], 0x4b);
});

test('isValidAdbSerial allows standard USB & TCP serials and rejects shell injection', () => {
  assert.equal(isValidAdbSerial('R58M920ABCD'), true);
  assert.equal(isValidAdbSerial('emulator-5554'), true);
  assert.equal(isValidAdbSerial('192.168.1.24:5555'), true);

  assert.equal(isValidAdbSerial('R58M920; rm -rf /'), false);
  assert.equal(isValidAdbSerial('abc && calc.exe'), false);
  assert.equal(isValidAdbSerial('$(whoami)'), false);
  assert.equal(isValidAdbSerial(''), false);
});

test('sanitizeExecutablePath enforces strict adb/scrcpy basename allowlist and blocks arbitrary binaries', () => {
  assert.equal(sanitizeExecutablePath('adb', 'adb'), 'adb');
  assert.equal(
    sanitizeExecutablePath('C:\\scrcpy-win64-v3.1\\adb.exe', 'adb'),
    'C:\\scrcpy-win64-v3.1\\adb.exe'
  );
  assert.equal(
    sanitizeExecutablePath('C:\\scrcpy-win64-v3.1\\scrcpy.exe', 'scrcpy'),
    'C:\\scrcpy-win64-v3.1\\scrcpy.exe'
  );

  // Reject arbitrary executables and shell metacharacters
  assert.equal(sanitizeExecutablePath('C:\\Windows\\System32\\cmd.exe', 'adb'), 'adb');
  assert.equal(sanitizeExecutablePath('/bin/sh', 'scrcpy'), 'scrcpy');
  assert.equal(sanitizeExecutablePath('adb; whoami', 'adb'), 'adb');
  assert.equal(sanitizeExecutablePath('scrcpy | dir', 'scrcpy'), 'scrcpy');
  assert.equal(sanitizeExecutablePath('   ', 'adb'), 'adb');
});

test('isValidWirelessHostPort validates IPv4 octets and port range strictly', () => {
  assert.equal(isValidWirelessHostPort('192.168.1.24:5555'), true);
  assert.equal(isValidWirelessHostPort('10.0.0.5:41235'), true);
  assert.equal(isValidWirelessHostPort('999.1.1.1:5555'), false);
  assert.equal(isValidWirelessHostPort('192.168.1.24:70000'), false);
  assert.equal(isValidWirelessHostPort('192.168.1.24; rm -rf /'), false);
  assert.equal(isValidWirelessHostPort('evil.com:5555'), false);
});

test('isAllowedLocalBridgeUrl restricts browser bridge strictly to loopback http://127.0.0.1 or localhost', () => {
  assert.equal(isAllowedLocalBridgeUrl('http://127.0.0.1:17890'), true);
  assert.equal(isAllowedLocalBridgeUrl('http://localhost:17890'), true);
  assert.equal(isAllowedLocalBridgeUrl('https://evil.example.com'), false);
  assert.equal(isAllowedLocalBridgeUrl('http://192.168.1.5:17890'), false);
  assert.equal(isAllowedLocalBridgeUrl('javascript:alert(1)'), false);
});

test('buildScrcpyArgs builds clean genymobile/scrcpy CLI flags with safe bounds', () => {
  const args = buildScrcpyArgs('R58M920ABCD', {
    max_size: 1280,
    max_fps: 30,
    no_audio: true,
    stay_awake: true,
    always_on_top: true,
    turn_screen_off: false,
  });
  assert.deepEqual(args, [
    '-s',
    'R58M920ABCD',
    '--max-size',
    '1280',
    '--max-fps',
    '30',
    '--no-audio',
    '--stay-awake',
    '--always-on-top',
    '--window-title',
    'Grab Agent Mirror (R58M920ABCD)',
  ]);

  // Native size (0) omits --max-size
  const nativeArgs = buildScrcpyArgs('R58M920ABCD', { max_size: 0, no_audio: false, stay_awake: false });
  assert.equal(nativeArgs.includes('--max-size'), false);
  assert.equal(nativeArgs.includes('--no-audio'), false);
});

test('parseAdbDevicesOutput parses device, unauthorized, and offline lines cleanly', () => {
  const sampleOutput = [
    'List of devices attached',
    'R58M920ABCD\tdevice usb:1-2 product:a54x model:SM_A546E device:a54x transport_id:1',
    'RZ8T100999\tunauthorized transport_id:2',
    'emulator-5554\toffline transport_id:3',
    '',
  ].join('\n');

  const parsed = parseAdbDevicesOutput(sampleOutput);
  assert.equal(parsed.length, 3);
  assert.deepEqual(parsed[0], {
    serial: 'R58M920ABCD',
    adb_state: 'device',
    model: 'SM A546E',
  });
  assert.deepEqual(parsed[1], {
    serial: 'RZ8T100999',
    adb_state: 'unauthorized',
    model: 'Android Device (USB ADB)',
  });
  assert.deepEqual(parsed[2], {
    serial: 'emulator-5554',
    adb_state: 'offline',
    model: 'Android Device (USB ADB)',
  });
});
