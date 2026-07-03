import { useState } from 'react';
import TabBar from './ui/TabBar';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SummaryScreen from '../screens/SummaryScreen';

const SCREENS = {
  tasks: HomeScreen,
  calendar: CalendarScreen,
  summary: SummaryScreen,
};

/** هيكل التطبيق بعد فك القفل: الشاشة النشطة + شريط التنقل السفلي */
export default function AppShell() {
  const [tab, setTab] = useState('tasks');
  const Screen = SCREENS[tab];

  return (
    <div className="app-shell">
      <Screen />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
