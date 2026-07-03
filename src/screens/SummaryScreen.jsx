import { ChartIcon } from '../components/ui/Icons';
import './screens.css';

/** تبويب الملخص اليومي والشامل — يُبنى في المرحلة الرابعة */
export default function SummaryScreen() {
  return (
    <main className="screen">
      <header className="screen-header">
        <h1>الملخص</h1>
      </header>
      <div className="placeholder">
        <ChartIcon size={44} />
        <p>ملخص اليوم والإحصائيات الشاملة — تُبنى في المرحلة الرابعة</p>
      </div>
    </main>
  );
}
