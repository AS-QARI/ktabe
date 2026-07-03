import { NoteIcon, CalendarIcon, ChartIcon } from './Icons';
import './TabBar.css';

const TABS = [
  { id: 'day', label: 'يومي', Icon: NoteIcon },
  { id: 'calendar', label: 'التقويم', Icon: CalendarIcon },
  { id: 'summary', label: 'الملخص', Icon: ChartIcon },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar" aria-label="التنقل الرئيسي">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`tabbar-item${active === id ? ' active' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => {
            navigator.vibrate?.(5); // نبضة لمسية خفيفة عند التنقل
            onChange(id);
          }}
        >
          <Icon size={26} strokeWidth={active === id ? 2.2 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
