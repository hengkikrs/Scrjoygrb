import type { ScrcpyLaunchOptions } from './types';

export const DEFAULT_SCRCPY_OPTIONS_CLIENT: ScrcpyLaunchOptions = {
  max_size: 1280,
  max_fps: 30,
  no_audio: true,
  stay_awake: true,
  always_on_top: false,
  turn_screen_off: false,
};

export function isAllowedLocalBridgeUrlClient(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:') return false;
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function formatScrcpyCommandPreview(
  scrcpyPath: string,
  serial: string,
  opts: ScrcpyLaunchOptions
): string {
  const bin = scrcpyPath.trim() || 'scrcpy';
  const parts = [bin, '-s', serial || 'DEVICE_SERIAL'];
  if (opts.max_size > 0) parts.push('--max-size', String(opts.max_size));
  parts.push('--max-fps', String(opts.max_fps));
  if (opts.no_audio) parts.push('--no-audio');
  if (opts.stay_awake) parts.push('--stay-awake');
  if (opts.always_on_top) parts.push('--always-on-top');
  if (opts.turn_screen_off) parts.push('--turn-screen-off');
  parts.push('--window-title', `"Grab Agent Mirror (${serial || 'DEVICE_SERIAL'})"`);
  return parts.join(' ');
}
