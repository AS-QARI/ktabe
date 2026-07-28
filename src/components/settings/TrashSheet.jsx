import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { deleteBlock, listTrashedBlocks, restoreBlock } from '../../data/storage';
import { TrashIcon } from '../ui/Icons';
import { formatFullDate, parseDateKey } from '../../utils/dates';

function plain(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** سلة شخصية بسيطة: استرجاع أولاً، والحذف النهائي قرار صريح فقط. */
export default function TrashSheet({ open, onClose }) {
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setError(null);
      setItems(await listTrashedBlocks());
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const restore = async (id) => {
    setBusyId(id);
    try { await restoreBlock(id); setItems((rows) => rows.filter((row) => row.id !== id)); }
    catch { setError('تعذر الاسترجاع، حاول مجدداً'); }
    finally { setBusyId(null); }
  };

  const remove = async (id) => {
    if (!window.confirm('حذف نهائي؟ لن يمكن استعادة هذا السطر بعد الآن.')) return;
    setBusyId(id);
    try { await deleteBlock(id); setItems((rows) => rows.filter((row) => row.id !== id)); }
    catch { setError('تعذر الحذف النهائي، حاول مجدداً'); }
    finally { setBusyId(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title="سلة المحذوفات" tall>
      <p className="settings-footer">العناصر المحذوفة لا تختفي نهائياً إلا إذا اخترت ذلك بنفسك.</p>
      {error && <div className="error-banner"><span>{error}</span><button type="button" onClick={load}>أعد المحاولة</button></div>}
      {items === null && !error && <div className="inline-loading"><div className="spinner" /></div>}
      {items?.length === 0 && <div className="empty-state"><TrashIcon size={36} /><p>سلة المحذوفات فارغة</p></div>}
      {items?.length > 0 && <div className="trash-list">{items.map((item) => {
        const page = item.pages;
        return <article key={item.id} className="trash-row"><div><strong>{plain(item.content) || 'سطر فارغ'}</strong><small>{page?.page_date ? formatFullDate(parseDateKey(page.page_date)) : 'ملاحظة قديمة'}</small></div><div className="trash-actions"><button type="button" disabled={busyId === item.id} onClick={() => restore(item.id)}>استرجاع</button><button type="button" className="danger" disabled={busyId === item.id} onClick={() => remove(item.id)}>حذف</button></div></article>;
      })}</div>}
    </Modal>
  );
}
