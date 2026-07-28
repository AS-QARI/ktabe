import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { createBlock, createPage, getDayPages, updatePage } from '../../data/storage';
import { todayKey } from '../../utils/dates';
import { CalendarIcon, NoteIcon, TaskCircleIcon } from '../ui/Icons';
import './QuickCapture.css';

const TEMPLATES = [
  { id: 'blank', label: 'فارغ', title: '', lines: [] },
  { id: 'meeting', label: 'اجتماع', title: 'اجتماع', lines: ['الحضور:', 'القرارات:', 'الخطوة التالية:'] },
  { id: 'review', label: 'مراجعة يومية', title: 'مراجعة اليوم', lines: ['ما أنجزته:', 'ما تعلمته:', 'أهم خطوة للغد:'] },
  { id: 'idea', label: 'فكرة', title: 'فكرة جديدة', lines: ['المشكلة:', 'الفكرة:', 'أول خطوة:'] },
];

function nextPageNo(pages) {
  return pages.length ? Math.max(...pages.map((page) => page.page_no || 1)) + 1 : 1;
}

/** التقاط سريع: مهمة أو ملاحظة أو قالب، من أي شاشة في ضغطة واحدة. */
export default function QuickCapture({ open, onClose }) {
  const [kind, setKind] = useState('task');
  const [text, setText] = useState('');
  const [dueDate, setDueDate] = useState(todayKey);
  const [priority, setPriority] = useState(0);
  const [repeatRule, setRepeatRule] = useState('none');
  const [templateId, setTemplateId] = useState('blank');
  const [busy, setBusy] = useState(false);

  const template = useMemo(
    () => TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0],
    [templateId]
  );

  const reset = () => {
    setKind('task');
    setText('');
    setDueDate(todayKey());
    setPriority(0);
    setRepeatRule('none');
    setTemplateId('blank');
    setBusy(false);
  };

  const ensureTodayPage = async () => {
    const key = todayKey();
    const pages = await getDayPages(key);
    if (pages[0]) return pages[0];
    return createPage(key, 1);
  };

  const save = async (event) => {
    event.preventDefault();
    const noteText = text.trim();
    const canSave = kind === 'task' ? noteText : noteText || template.lines.length;
    if (!canSave || busy) return;
    setBusy(true);
    try {
      if (kind === 'task') {
        const page = await ensureTodayPage();
        const existing = (page.blocks ?? []).filter((block) => !block.parent_id);
        const position = existing.length ? Math.max(...existing.map((block) => block.position || 0)) + 1 : 1;
        await createBlock({
          page_id: page.id,
          kind: 'task',
          content: noteText,
          position,
          due_date: dueDate,
          priority,
          repeat_rule: repeatRule,
        });
      } else {
        const pages = await getDayPages(todayKey());
        const note = await createPage(todayKey(), nextPageNo(pages));
        if (template.title || noteText) {
          await updatePage(note.id, { title: noteText || template.title });
        }
        const lines = template.lines.length ? template.lines : [''];
        await Promise.all(
          lines.map((line, index) =>
            createBlock({ page_id: note.id, kind: 'text', content: line, position: index + 1 })
          )
        );
      }
      reset();
      onClose();
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="التقاط سريع">
      <form onSubmit={save} className="quick-capture">
        <div className="capture-kind" role="radiogroup" aria-label="نوع الالتقاط">
          <button type="button" role="radio" aria-checked={kind === 'task'} className={kind === 'task' ? 'active' : ''} onClick={() => setKind('task')}>
            <TaskCircleIcon size={17} /> مهمة
          </button>
          <button type="button" role="radio" aria-checked={kind === 'note'} className={kind === 'note' ? 'active' : ''} onClick={() => setKind('note')}>
            <NoteIcon size={17} /> ملاحظة
          </button>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="quick-capture-text">{kind === 'task' ? 'ما الذي تريد إنجازه؟' : 'عنوان الملاحظة'}</label>
          <input id="quick-capture-text" className="form-input" autoFocus value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder={kind === 'task' ? 'مثال: إرسال التقرير' : 'اكتب الفكرة قبل أن تضيع'} />
        </div>

        {kind === 'task' ? (
          <>
            <div className="field">
              <label className="field-label" htmlFor="quick-capture-date">الموعد</label>
              <div className="capture-date">
                <CalendarIcon size={18} />
                <input id="quick-capture-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>
            <div className="field">
              <span className="field-label">الأولوية والتكرار</span>
              <div className="capture-options">
                <select value={priority} onChange={(event) => setPriority(Number(event.target.value))} aria-label="أولوية المهمة">
                  <option value="0">عادية</option><option value="1">منخفضة</option><option value="2">مهمة</option><option value="3">عاجلة</option>
                </select>
                <select value={repeatRule} onChange={(event) => setRepeatRule(event.target.value)} aria-label="تكرار المهمة">
                  <option value="none">مرة واحدة</option><option value="daily">يومياً</option><option value="weekly">أسبوعياً</option><option value="monthly">شهرياً</option>
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <span className="field-label">ابدأ بقالب</span>
            <div className="capture-templates">
              {TEMPLATES.map((item) => <button key={item.id} type="button" className={templateId === item.id ? 'active' : ''} onClick={() => setTemplateId(item.id)}>{item.label}</button>)}
            </div>
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={busy || (kind === 'task' ? !text.trim() || !dueDate : !text.trim() && !template.lines.length)}>
          {busy ? 'جارٍ الحفظ…' : kind === 'task' ? 'إضافة المهمة' : 'إنشاء الملاحظة'}
        </button>
      </form>
    </Modal>
  );
}
