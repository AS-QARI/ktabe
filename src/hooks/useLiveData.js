import { useCallback, useEffect, useRef, useState } from 'react';
import { onTablesChange } from '../data/storage';

/**
 * بيانات حية: تحميل أولي + إعادة تحميل تلقائية عند أي تغيير يصل عبر
 * Realtime (من هذا الجهاز أو من أجهزة أخرى) + reload يدوي بعد الكتابة.
 *
 * @param {() => Promise<any>} loader دالة تحميل من طبقة البيانات (مرجع ثابت)
 * @param {string[]} tables أسماء الجداول المراقبة (مصفوفة ثابتة الهوية)
 */
export function useLiveData(loader, tables) {
  const [data, setData] = useState(null); // null = ما زال يحمّل
  const [error, setError] = useState(null);
  const debounce = useRef(null);

  const reload = useCallback(async () => {
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [loader]);

  useEffect(() => {
    reload();
    // تجميع الإشعارات المتقاربة (استيراد نسخة مثلاً) في إعادة تحميل واحدة
    const off = onTablesChange(tables, () => {
      clearTimeout(debounce.current);
      debounce.current = setTimeout(reload, 200);
    });
    return () => {
      off();
      clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  return { data, error, reload, setData };
}
