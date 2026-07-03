import { ChecklistIcon } from '../components/ui/Icons';
import './screens.css';

/** تبويب المهام واليوميات — يُبنى في المرحلة الثانية */
export default function HomeScreen() {
  return (
    <main className="screen">
      <header className="screen-header">
        <h1>المهام</h1>
      </header>
      <div className="placeholder">
        <ChecklistIcon size={44} />
        <p>قائمة المهام ومساحة الكتابة الحرة — تُبنى في المرحلة الثانية</p>
      </div>
    </main>
  );
}
