// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LiveReaderPlugin, LiveReaderStatus } from '../../services/liveReader';
import { isAndroidApp } from '../../services/liveReader';
import { ToastProvider } from '../components/Toast';
import { LiveReaderSection } from '../screens/LiveReaderSection';

afterEach(() => cleanup());

function fakePlugin(initial: Partial<LiveReaderStatus>) {
  let status: LiveReaderStatus = {
    serviceEnabled: false,
    captureEnabled: false,
    captures: 0,
    bytes: 0,
    uberInstalled: true,
    boltInstalled: true,
    ...initial,
  };
  const plugin: LiveReaderPlugin = {
    getStatus: vi.fn(async () => status),
    openAccessibilitySettings: vi.fn(async () => {}),
    openAppDetails: vi.fn(async () => {}),
    openBatterySettings: vi.fn(async () => {}),
    setCaptureEnabled: vi.fn(async ({ enabled }) => {
      status = { ...status, captureEnabled: enabled };
    }),
    shareCaptures: vi.fn(async () => {}),
    clearCaptures: vi.fn(async () => {
      status = { ...status, captures: 0, bytes: 0 };
    }),
    shareFile: vi.fn(async () => {}),
  };
  return plugin;
}

const renderSection = (plugin: LiveReaderPlugin) =>
  render(
    <ToastProvider>
      <LiveReaderSection plugin={plugin} />
    </ToastProvider>,
  );

describe('Citire automată (Android)', () => {
  it('în browser (iPhone, PWA) secțiunea nu apare', () => {
    expect(isAndroidApp()).toBe(false);
  });

  it('serviciul oprit: arată cei trei pași și deschide setările potrivite', async () => {
    const user = userEvent.setup();
    const plugin = fakePlugin({ boltInstalled: false });
    renderSection(plugin);
    expect(await screen.findByText('Serviciul e oprit')).toBeTruthy();
    expect(screen.getByText('Nu găsesc pe telefon: Bolt Driver')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Deschide informațiile aplicației' }));
    await user.click(screen.getByRole('button', { name: 'Deschide Accesibilitate' }));
    await user.click(screen.getByRole('button', { name: 'Deschide setările bateriei' }));
    expect(plugin.openAppDetails).toHaveBeenCalledOnce();
    expect(plugin.openAccessibilitySettings).toHaveBeenCalledOnce();
    expect(plugin.openBatterySettings).toHaveBeenCalledOnce();
  });

  it('serviciul pornit: pașii dispar; înregistrarea pornește, se trimite și se șterge', async () => {
    const user = userEvent.setup();
    const plugin = fakePlugin({ serviceEnabled: true, captures: 1234, bytes: 2_400_000 });
    renderSection(plugin);
    expect(await screen.findByText('Serviciul e pornit')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Deschide Accesibilitate' })).toBeNull();
    expect(screen.getByText('1.234 ecrane înregistrate · 2,4 MB')).toBeTruthy();

    await user.click(screen.getByRole('checkbox', { name: /Înregistrează ecranele Uber și Bolt/ }));
    expect(plugin.setCaptureEnabled).toHaveBeenCalledWith({ enabled: true });
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true));

    await user.click(screen.getByRole('button', { name: 'Trimite' }));
    expect(plugin.shareCaptures).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Șterge' }));
    expect(await screen.findByText('Niciun ecran înregistrat.')).toBeTruthy();
  });
});
