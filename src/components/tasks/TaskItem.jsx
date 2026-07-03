import { CheckIcon } from '../ui/Icons';
import { relativeDayLabel, todayKey } from '../../utils/dates';
import './TaskItem.css';

/**
 * صف مهمة واحد بأسلوب "التذكيرات" في iOS:
 * دائرة إكمال على الطرف، العنوان والتفاصيل، وشارة تاريخ الاستحقاق.
 * الضغط على الدائرة يبدّل الإكمال، والضغط على الصف يفتح التعديل.
 */
export default function TaskItem({ task, onToggle, onOpen }) {
  const overdue =
    !task.is_completed && task.due_date && task.due_date < todayKey();

  return (
    <div className={`task-item${task.is_completed ? ' done' : ''}`}>
      <button
        type="button"
        className="task-check"
        role="checkbox"
        aria-checked={task.is_completed}
        aria-label={task.is_completed ? 'إلغاء الإكمال' : 'إكمال المهمة'}
        onClick={() => {
          navigator.vibrate?.(10);
          onToggle(task);
        }}
      >
        <span className="task-check-circle">
          <CheckIcon size={13} />
        </span>
      </button>

      <button type="button" className="task-main" onClick={() => onOpen(task)}>
        <span className="task-title-row">
          {task.priority > 0 && (
            <span
              className={`task-priority p${task.priority}`}
              aria-label={task.priority === 2 ? 'أولوية عالية' : 'أولوية متوسطة'}
            />
          )}
          <span className="task-title">{task.title}</span>
        </span>
        {(task.due_date || task.description) && (
          <span className="task-meta">
            {task.due_date && (
              <span className={`task-due${overdue ? ' overdue' : ''}`}>
                {relativeDayLabel(task.due_date)}
              </span>
            )}
            {task.description && (
              <span className="task-desc-hint">{task.description}</span>
            )}
          </span>
        )}
      </button>
    </div>
  );
}
