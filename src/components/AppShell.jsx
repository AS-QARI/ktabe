import { lazy, Suspense, useState } from 'react';
import TabBar from './ui/TabBar';
import SettingsSheet from './settings/SettingsSheet';
import DayScreen from '../screens/DayScreen';
import QuickCapture from './capture/QuickCapture';
import { PlusIcon } from './ui/Icons';
import { todayKey } from '../utils/dates';

const TAB_IDS = ['day', 'calendar', 'summary', 'search'];
const CalendarScreen = lazy(() => import('../screens/CalendarScreen'));
const SummaryScreen = lazy(() => import('../screens/SummaryScreen'));
const SearchScreen = lazy(() => import('../screens/SearchScreen'));

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
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([initialTab()]));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [dayDate, setDayDate] = useState(todayKey);

  const openSettings = () => setSettingsOpen(true);

  /** من التقويم: افتح صفحة يوم محدد في الدفتر */
  const openDay = (dateKey) => {
    setDayDate(dateKey);
    selectTab('day');
  };

  const selectTab = (nextTab) => {
    setVisitedTabs((current) => {
      if (current.has(nextTab)) return current;
      return new Set([...current, nextTab]);
    });
    setTab(nextTab);
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
      <Suspense fallback={<div className="tab-panel-loading"><div className="spinner" /></div>}>
        {visitedTabs.has('calendar') && (
          <div className="tab-panel" hidden={tab !== 'calendar'}>
            <CalendarScreen onOpenSettings={openSettings} onOpenDay={openDay} />
          </div>
        )}
        {visitedTabs.has('summary') && (
          <div className="tab-panel" hidden={tab !== 'summary'}>
            <SummaryScreen onOpenSettings={openSettings} />
          </div>
        )}
        {visitedTabs.has('search') && (
          <div className="tab-panel" hidden={tab !== 'search'}>
            <SearchScreen onOpenDay={openDay} />
          </div>
        )}
      </Suspense>

      {/* شاشة يومي فيها زرّها الخاص لفتح صفحة كتابة — لا نكرّره بزر يفتح مركّب مهمة بموعد */}
      {tab !== 'day' && (
        <button type="button" className="app-capture-fab" aria-label="التقاط سريع" onClick={() => setCaptureOpen(true)}>
          <PlusIcon size={23} />
        </button>
      )}

      <TabBar active={tab} onChange={selectTab} />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}
