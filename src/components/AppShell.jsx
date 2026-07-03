import { useState } from 'react';
import TabBar from './ui/TabBar';
import SettingsSheet from './settings/SettingsSheet';
import DayScreen from '../screens/DayScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SummaryScreen from '../screens/SummaryScreen';
import { todayKey } from '../utils/dates';

const TAB_IDS = ['day', 'calendar', 'summary'];

/** يقرأ التبويب الابتدائي من الرابط (#tab=calendar) إن وُجد */
function initialTab() {
  const m = window.location.hash.match(/tab=(\w+)/);
  return m && TAB_IDS.includes(m[1]) ? m[1] : 'day';
}

/**
 * هيكل التطبيق بعد فك القفل.
 * الشاشات الثلاث تبقى مركّبة دائماً (تُخفى بدل أن تُزال):
 * التنقل لحظي بلا إعادة تحميل، وتُحفظ حالة كل شاشة — كتبويبات iOS.
 */
export default function AppShell() {
  const [tab, setTab] = useState(initialTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dayDate, setDayDate] = useState(todayKey);

  const openSettings = () => setSettingsOpen(true);

  /** من التقويم: افتح صفحة يوم محدد في الدفتر */
  const openDay = (dateKey) => {
    setDayDate(dateKey);
    setTab('day');
  };

  return (
    <div className="app-shell">
      <div className="tab-panel" hidden={tab !== 'day'}>
        <DayScreen
          dateKey={dayDate}
          onDateChange={setDayDate}
          onOpenSettings={openSettings}
        />
      </div>
      <div className="tab-panel" hidden={tab !== 'calendar'}>
        <CalendarScreen onOpenSettings={openSettings} onOpenDay={openDay} />
      </div>
      <div className="tab-panel" hidden={tab !== 'summary'}>
        <SummaryScreen onOpenSettings={openSettings} />
      </div>

      <TabBar active={tab} onChange={setTab} />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
