import { CalendarIcon } from '../components/ui/Icons';
import './screens.css';

/** تبويب التقويم والعدادات التنازلية — يُبنى في المرحلة الثالثة */
export default function CalendarScreen() {
  return (
    <main className="screen">
      <header className="screen-header">
        <h1>التقويم</h1>
      </header>
      <div className="placeholder">
        <CalendarIcon size={44} />
        <p>التقويم الشهري والعدادات التنازلية — تُبنى في المرحلة الثالثة</p>
      </div>
    </main>
  );
}
