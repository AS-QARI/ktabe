import { useMemo, useState } from 'react';
import { exportAll } from '../data/storage';
import { useLiveData } from '../hooks/useLiveData';
import { formatFullDate, parseDateKey } from '../utils/dates';
import { CalendarIcon, SearchIcon, TagIcon, TaskCircleIcon } from '../components/ui/Icons';
import './screens.css';
import './SearchScreen.css';

const TABLES = ['pages', 'blocks'];
const TAG_RE = /#([\p{L}\p{N}_-]+)/gu;

function plain(content = '') {
  return content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function tagsOf(value) {
  return [...value.matchAll(TAG_RE)].map((match) => match[1].toLowerCase());
}

function snippet(value, needle) {
  const text = plain(value);
  const index = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : 0;
  const start = Math.max(0, index - 45);
  return `${start ? '…' : ''}${text.slice(start, start + 130)}${text.length > start + 130 ? '…' : ''}`;
}

export default function SearchScreen({ onOpenDay }) {
  const live = useLiveData(exportAll, TABLES);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const needle = query.trim().toLowerCase().replace(/^#/, '');

  const { results, tags } = useMemo(() => {
    const pages = live.data?.pages ?? [];
    const pageById = new Map(pages.map((page) => [page.id, page]));
    const tagCounts = new Map();
    const items = [];
    for (const block of live.data?.blocks ?? []) {
      if (block.deleted_at) continue;
      const page = pageById.get(block.page_id);
      if (!page) continue;
      const text = `${page.title ?? ''} ${plain(block.content)}`;
      for (const tag of tagsOf(text)) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      const type = block.kind === 'task' ? 'task' : 'note';
      if (scope === 'notes' && type !== 'note') continue;
      if (scope === 'tasks' && type !== 'task') continue;
      if (scope === 'open' && (type !== 'task' || block.is_completed)) continue;
      const matches = !needle || (query.trim().startsWith('#') ? tagsOf(text).includes(needle) : text.toLowerCase().includes(needle));
      if (matches) items.push({ block, page, type, text });
    }
    items.sort((a, b) => new Date(b.block.updated_at ?? b.block.created_at) - new Date(a.block.updated_at ?? a.block.created_at));
    return { results: items.slice(0, 80), tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  }, [live.data, needle, query, scope]);

  return (
    <main className="screen search-screen">
      <header className="search-head"><div><h1>البحث</h1><p>كل ملاحظاتك ومهامك في مكان واحد</p></div></header>
      <label className="search-input"><SearchIcon size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث أو اكتب #وسم" autoComplete="off" /><span>{results.length}</span></label>
      <div className="search-scopes" role="tablist" aria-label="نطاق البحث">
        {[['all', 'الكل'], ['notes', 'ملاحظات'], ['tasks', 'مهام'], ['open', 'مفتوحة']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={scope === id} className={scope === id ? 'active' : ''} onClick={() => setScope(id)}>{label}</button>)}
      </div>
      {tags.length > 0 && <section className="tag-cloud" aria-label="الوسوم الشائعة"><TagIcon size={16} />{tags.map(([tag, count]) => <button key={tag} type="button" onClick={() => setQuery(`#${tag}`)}>#{tag} <small>{count}</small></button>)}</section>}
      {live.error && <div className="error-banner"><span>تعذر تحميل البحث</span><button type="button" onClick={live.reload}>أعد المحاولة</button></div>}
      {!live.error && live.data === null && <div className="inline-loading"><div className="spinner" /></div>}
      {live.data && <div className="search-results">{results.length === 0 ? <div className="empty-state"><SearchIcon size={34} /><p>{query ? 'لا توجد نتائج مطابقة' : 'ابدأ بالبحث في ملاحظاتك ومهامك'}</p></div> : results.map(({ block, page, type }) => <button key={block.id} type="button" className="search-result" onClick={() => onOpenDay(page.page_date)}><span className={`search-result-icon ${type}`} >{type === 'task' ? <TaskCircleIcon size={18} /> : <CalendarIcon size={18} />}</span><span className="search-result-copy"><strong>{type === 'task' ? plain(block.content) || 'مهمة بلا نص' : page.title || plain(block.content) || 'ملاحظة'}</strong><small>{snippet(type === 'task' ? block.content : `${page.title ?? ''} ${block.content}`, needle)}</small><em>{formatFullDate(parseDateKey(page.page_date))}{block.due_date ? ` · موعد ${block.due_date}` : ''}</em></span>{type === 'task' && block.priority > 1 && <b className={`priority-dot p${block.priority}`}>!</b>}</button>)}</div>}
    </main>
  );
}
