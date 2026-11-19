import { fileToBase64, isNativeApp, LiveReader } from './liveReader';

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Salvează un fișier: în aplicația Android prin foaia de partajare a sistemului; pe iPhone prin foaia de partajare (Salvează în Fișiere, AirDrop, e-mail),
 * altfel ca descărcare. Trebuie apelată direct dintr-o apăsare de buton (iOS cere asta).
 */
export async function shareOrDownload(file: File): Promise<ShareOutcome> {
  if (isNativeApp()) {
    // în aplicația Android, WebView-ul nu are foaia de partajare: o deschide pluginul nativ
    await LiveReader.shareFile({ name: file.name, mime: file.type || 'application/octet-stream', data: await fileToBase64(file) });
    return 'shared';
  }
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // altă eroare (ex. activare expirată): încercăm descărcarea
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
