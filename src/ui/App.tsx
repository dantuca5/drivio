import { useEffect, useState } from 'react';
import type { PeriodSpec } from '../domain';
import { useApplyTheme, useSettings } from '../features/hooks';
import type { AppSettings, RideEntity } from '../services/entities';
import { requestPersistentStorage } from '../services/db';
import { purgeOldTrash } from '../services/repositories';
import { BackupSheet, ExportSheet, RestoreSheet, TrashSheet } from './sheets/DataSheets';
import type { DataSheetKind } from './screens/SettingsScreen';
import { Icon, type IconName } from './components/Icon';
import { ToastProvider } from './components/Toast';
import { UpdatePrompt } from './components/UpdatePrompt';
import { HistoryScreen } from './screens/HistoryScreen';
import { HomeScreen } from './screens/HomeScreen';
import { Onboarding } from './screens/Onboarding';
import { RideSheet, type RideSheetMode } from './screens/RideSheet';
import { SettingsScreen } from './screens/SettingsScreen';
import { ToolsScreen } from './screens/ToolsScreen';

type Tab = 'home' | 'history' | 'tools' | 'settings';

const TABS: { id: Tab; label: string; icon: IconName; title: string }[] = [
  { id: 'home', label: 'Acasă', icon: 'home', title: 'Acasă' },
  { id: 'history', label: 'Istoric', icon: 'list', title: 'Istoric' },
  { id: 'tools', label: 'Unelte', icon: 'tools', title: 'Unelte' },
  { id: 'settings', label: 'Setări', icon: 'gear', title: 'Setări' },
];

export function App() {
  const settings = useSettings();
  useApplyTheme(settings?.theme);

  if (settings === undefined) return null; // se încarcă (sub o clipă)
  return (
    <ToastProvider>
      <div className="status-band" aria-hidden="true" />
      {import.meta.env.PROD && <UpdatePrompt />}
      {settings === null ? <Onboarding /> : <Shell settings={settings} />}
    </ToastProvider>
  );
}

function Shell({ settings }: { settings: AppSettings }) {
  const [tab, setTab] = useState<Tab>('home');
  const [sheet, setSheet] = useState<{ mode: RideSheetMode; ride?: RideEntity } | null>(null);
  const [data, setData] = useState<{ kind: DataSheetKind; period?: PeriodSpec } | null>(null);
  const current = TABS.find((t) => t.id === tab)!;

  // La pornire: golește coșul de elementele mai vechi de 30 de zile și cere din nou
  // stocare persistentă (iOS o poate acorda mai târziu, după ce aplicația e folosită).
  useEffect(() => {
    void purgeOldTrash(new Date());
    void requestPersistentStorage();
  }, []);

  const tabButton = (t: (typeof TABS)[number]) => (
    <button
      key={t.id}
      type="button"
      className="tab"
      aria-current={tab === t.id ? 'page' : undefined}
      onClick={() => {
        setTab(t.id);
        window.scrollTo({ top: 0 });
      }}
    >
      <Icon name={t.icon} />
      {t.label}
    </button>
  );

  return (
    <>
      <main className="app-main">
        <header className="screen-head">
          <h1 className="screen-title">{current.title}</h1>
        </header>
        {tab === 'home' && (
          <HomeScreen settings={settings} onExport={(period) => setData({ kind: 'export', period })} onBackup={() => setData({ kind: 'backup' })} />
        )}
        {tab === 'history' && <HistoryScreen settings={settings} onOpenRide={(ride) => setSheet({ mode: 'edit', ride })} />}
        {tab === 'tools' && <ToolsScreen settings={settings} onSimulate={() => setSheet({ mode: 'simulate' })} />}
        {tab === 'settings' && <SettingsScreen settings={settings} onOpenData={(kind) => setData({ kind })} />}
      </main>

      <nav className="tabbar" aria-label="Navigare">
        {tabButton(TABS[0]!)}
        {tabButton(TABS[1]!)}
        <button type="button" className="tab tab-plus" aria-label="Cursă nouă" onClick={() => setSheet({ mode: 'new' })}>
          <span><Icon name="plus" /></span>
        </button>
        {tabButton(TABS[2]!)}
        {tabButton(TABS[3]!)}
      </nav>

      {sheet && (
        <RideSheet
          key={sheet.ride?.id ?? sheet.mode}
          mode={sheet.mode}
          ride={sheet.ride}
          settings={settings}
          onClose={() => setSheet(null)}
        />
      )}

      {data?.kind === 'export' && <ExportSheet settings={settings} initialPeriod={data.period} onClose={() => setData(null)} />}
      {data?.kind === 'backup' && <BackupSheet settings={settings} onClose={() => setData(null)} />}
      {data?.kind === 'restore' && <RestoreSheet onClose={() => setData(null)} />}
      {data?.kind === 'trash' && <TrashSheet settings={settings} onClose={() => setData(null)} />}
    </>
  );
}
