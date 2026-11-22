import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export type IconName =
  | 'activity'
  | 'arrowUpRight'
  | 'calendar'
  | 'check'
  | 'chevronDown'
  | 'clock'
  | 'file'
  | 'grid'
  | 'heart'
  | 'more'
  | 'plus'
  | 'search'
  | 'settings'
  | 'users'
  | 'wallet';

const iconPaths: Record<IconName, ReactNode> = {
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
  arrowUpRight: <><path d="M7 17 17 7M7 7h10v10" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
  heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 1 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 1 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 1 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 1 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 1 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 15h.01" /></>,
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg aria-hidden="true" className={className ?? 'cc-icon'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[name]}
    </svg>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: IconName };

export function PrimaryButton({ children, className = '', icon, ...props }: ButtonProps) {
  return <button className={`cc-button cc-button-primary ${className}`} {...props}>{icon && <Icon name={icon} />}{children}</button>;
}

export function SecondaryButton({ children, className = '', icon, ...props }: ButtonProps) {
  return <button className={`cc-button cc-button-secondary ${className}`} {...props}>{icon && <Icon name={icon} />}{children}</button>;
}

export type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function InputField({ label, hint, error, id, className = '', ...props }: InputFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  return (
    <div className="cc-field">
      <label className="cc-label" htmlFor={inputId}>{label}</label>
      <input id={inputId} className={`cc-input ${error ? 'has-error' : ''} ${className}`} aria-invalid={Boolean(error)} aria-describedby={error || hint ? hintId : undefined} {...props} />
      {(error || hint) && <span className={`cc-field-note ${error ? 'is-error' : ''}`} id={hintId}>{error ?? hint}</span>}
    </div>
  );
}

export function SearchBar({ placeholder = 'Search patients, appointments...', className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`cc-search ${className}`}>
      <Icon name="search" />
      <input type="search" aria-label="Search" placeholder={placeholder} {...props} />
      <kbd>⌘ K</kbd>
    </label>
  );
}

export function AppHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="cc-app-header">
      <div><p className="cc-eyebrow">CLINICCARE / OVERVIEW</p><h1>{title}</h1>{subtitle && <p className="cc-muted">{subtitle}</p>}</div>
      {children && <div className="cc-header-actions">{children}</div>}
    </header>
  );
}

export type NavigationItem = { id: string; label: string; icon: IconName };

export function BottomNavigation({ items, activeId, onChange }: { items: NavigationItem[]; activeId: string; onChange: (id: string) => void }) {
  return (
    <nav className="cc-bottom-nav" aria-label="Main navigation">
      {items.map((item) => <button key={item.id} type="button" className={activeId === item.id ? 'is-active' : ''} aria-current={activeId === item.id ? 'page' : undefined} onClick={() => onChange(item.id)}><Icon name={item.icon} /><span>{item.label}</span></button>)}
    </nav>
  );
}

export function StatCard({ title, value, delta, icon, tone = 'blue' }: { title: string; value: string; delta: string; icon: IconName; tone?: 'blue' | 'teal' | 'violet' | 'amber' }) {
  return (
    <article className="cc-stat-card">
      <div className="cc-stat-top"><span className={`cc-icon-tile tone-${tone}`}><Icon name={icon} /></span><span className="cc-stat-delta"><Icon name="arrowUpRight" />{delta}</span></div>
      <p className="cc-stat-label">{title}</p><p className="cc-stat-value">{value}</p>
    </article>
  );
}

export type AppointmentStatus = 'Confirmed' | 'Waiting' | 'Completed' | 'Cancelled';

export function StatusBadge({ status }: { status: AppointmentStatus | 'Paid' | 'Pending' | 'Overdue' | 'Connected' | 'Unavailable' }) {
  return <span className={`cc-status status-${status.toLowerCase()}`}><span />{status}</span>;
}

export function AppointmentCard({ name, initials, specialty, time, status }: { name: string; initials: string; specialty: string; time: string; status: AppointmentStatus }) {
  return (
    <article className="cc-appointment-row">
      <span className="cc-avatar">{initials}</span>
      <div className="cc-row-main"><strong>{name}</strong><span>{specialty}</span></div>
      <span className="cc-appointment-time"><Icon name="clock" />{time}</span>
      <StatusBadge status={status} />
      <button className="cc-icon-button" type="button" aria-label={`More options for ${name}`}><Icon name="more" /></button>
    </article>
  );
}

export function PatientCard({ name, initials, detail, lastVisit, tone = 'blue' }: { name: string; initials: string; detail: string; lastVisit: string; tone?: 'blue' | 'teal' | 'violet' }) {
  return (
    <article className="cc-patient-card">
      <span className={`cc-avatar avatar-${tone}`}>{initials}</span>
      <div className="cc-row-main"><strong>{name}</strong><span>{detail}</span></div>
      <span className="cc-patient-visit">{lastVisit}</span>
    </article>
  );
}

export function PaymentCard({ title, amount, date, status }: { title: string; amount: string; date: string; status: 'Paid' | 'Pending' | 'Overdue' }) {
  return (
    <article className="cc-payment-row">
      <span className="cc-icon-tile tone-teal"><Icon name="wallet" /></span>
      <div className="cc-row-main"><strong>{title}</strong><span>{date}</span></div>
      <strong className="cc-payment-amount">{amount}</strong><StatusBadge status={status} />
    </article>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="cc-state"><span className="cc-state-icon"><Icon name="file" /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function LoadingState({ label = 'Loading your clinic data...' }: { label?: string }) {
  return <div className="cc-inline-state" role="status"><span className="cc-spinner" />{label}</div>;
}

export function ErrorState({ title = 'Something went wrong', description, action }: { title?: string; description: string; action?: ReactNode }) {
  return <div className="cc-state cc-error-state" role="alert"><span className="cc-state-icon"><Icon name="activity" /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ConfirmationModal({ open, title, description, confirmLabel = 'Confirm', onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel?: string; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="cc-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="cc-modal" role="dialog" aria-modal="true" aria-labelledby="cc-modal-title" aria-describedby="cc-modal-description">
        <span className="cc-icon-tile tone-blue"><Icon name="calendar" /></span><h2 id="cc-modal-title">{title}</h2><p id="cc-modal-description">{description}</p>
        <div className="cc-modal-actions"><SecondaryButton onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton onClick={onConfirm}>{confirmLabel}</PrimaryButton></div>
      </section>
    </div>
  );
}

export function DatePicker({ label = 'Date', ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return <InputField label={label} type="date" {...props} />;
}

export function TimeSlotSelector({ slots, value, onChange }: { slots: string[]; value?: string; onChange: (slot: string) => void }) {
  return (
    <div className="cc-time-slots" role="group" aria-label="Available appointment times">
      {slots.map((slot) => <button key={slot} type="button" className={value === slot ? 'is-selected' : ''} aria-pressed={value === slot} onClick={() => onChange(slot)}>{slot}</button>)}
    </div>
  );
}

export function DocumentUploader({ label = 'Upload document', accept = '.pdf,.jpg,.jpeg,.png', multiple = true, onFilesSelected }: { label?: string; accept?: string; multiple?: boolean; onFilesSelected?: (files: FileList | null) => void }) {
  const inputId = useId();
  return (
    <label className="cc-uploader" htmlFor={inputId}><span className="cc-upload-icon"><Icon name="file" /></span><strong>{label}</strong><span>PDF or image files, up to 10 MB each</span><input id={inputId} type="file" accept={accept} multiple={multiple} onChange={(event) => onFilesSelected?.(event.currentTarget.files)} /></label>
  );
}

export function PrescriptionCard({ medication, dosage, instructions, prescribedBy }: { medication: string; dosage: string; instructions: string; prescribedBy: string }) {
  return (
    <article className="cc-prescription-card">
      <span className="cc-icon-tile tone-teal"><Icon name="file" /></span><div className="cc-row-main"><strong>{medication}</strong><span>{dosage} · {instructions}</span><small>Prescribed by {prescribedBy}</small></div>
    </article>
  );
}

export function ChartCard({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="cc-panel cc-chart-card"><div className="cc-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</section>;
}
