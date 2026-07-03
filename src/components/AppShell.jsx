import { useState } from 'react';
import TabBar from './ui/TabBar';
import SettingsSheet from './settings/SettingsSheet';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SummaryScreen from '../screens/SummaryScreen';

const TAB_IDS = ['tasks', 'calendar', 'summary'];

/** يقرأ التبويب الابتدائي من الرابط (#tab=calendar) إن وُجد */
function initialTab() {
  const m = window.location.hash.match(/tab=(\w+)/);
  return m && TAB_IDS.includes(m[1]) ? m[1] : 'tasks';
}

/**
 * هيكل التطبيق بعد فك القفل.
 * الشاشات الثلاث تبقى مركّبة دائماً (تُخفى بدل أن تُزال):
 * التنقل لحظي بلا إعادة تحميل، وتُحفظ حالة كل شاشة — تماماً كتبويبات iOS.
 */
export default function AppShell() {
  const [tab, setTab] = useState(initialTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => setSettingsOpen(true);

  return (
    <div className="app-shell">
      <div className="tab-panel" hidden={tab !== 'tasks'}>
        <HomeScreen onOpenSettings={openSettings} />
      </div>
      <div className="tab-panel" hidden={tab !== 'calendar'}>
        <CalendarScreen onOpenSettings={openSettings} />
      </div>
      <div className="tab-panel" hidden={tab !== 'summary'}>
        <SummaryScreen onOpenSettings={openSettings} />
      </div>

      <TabBar active={tab} onChange={setTab} />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
