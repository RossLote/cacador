/**
 * The progress file as the browser handles it (phase 4 D8): the export made
 * into a File, saved with a download link, and the check for a share sheet
 * that takes files.
 */
import { exportFileName, exportProgress } from '@/storage';

const JSON_TYPE = 'application/json';

/** Everything on this device as cacador-progress-<YYYY-MM-DD>.json. */
export async function makeProgressFile(now: number = Date.now()): Promise<File> {
  const file = await exportProgress(now);
  return new File([JSON.stringify(file)], exportFileName(now), { type: JSON_TYPE });
}

/** Saves `file` under its own name through an <a download> on an object URL, revoked once the click has been handled. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Whether this browser's share sheet can take a progress file (most phones); checked with an empty stand-in. */
export function canShareProgressFile(): boolean {
  const probe = new File(['{}'], exportFileName(), { type: JSON_TYPE });
  try {
    return navigator.canShare?.({ files: [probe] }) === true;
  } catch {
    return false;
  }
}
