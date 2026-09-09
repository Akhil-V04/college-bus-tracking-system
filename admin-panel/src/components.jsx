export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function Notice({ message, onDismiss }) {
  if (!message) return null;
  const type = typeof message === 'string' ? 'info' : message.type || 'info';
  const text = typeof message === 'string' ? message : message.text;
  return <div className={`notice notice-${type}`}><span>{text}</span>{onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss">×</button>}</div>;
}

export function StatusBadge({ value }) {
  const normalized = String(value || 'UNKNOWN').toLowerCase();
  return <span className={`status-badge status-${normalized}`}>{String(value || 'Unknown').replaceAll('_', ' ')}</span>;
}

export function LoadingState({ label = 'Loading data…' }) {
  return <div className="state-card"><div className="spinner" /><p>{label}</p></div>;
}

export function EmptyState({ title, description }) {
  return <div className="state-card state-card-empty"><div className="empty-icon">○</div><strong>{title}</strong>{description && <p>{description}</p>}</div>;
}

export function Modal({ title, description, children, onClose, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true"
        aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </section>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
