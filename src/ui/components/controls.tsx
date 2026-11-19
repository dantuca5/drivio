import { useId, type ReactNode } from 'react';

interface NumberFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  error?: string | undefined;
  hint?: string;
  big?: boolean;
  className?: string;
  autoFocus?: boolean;
  /** „numeric” pentru valori întregi (minute) */
  mode?: 'decimal' | 'numeric';
  placeholder?: string;
}

/** Câmp numeric: tastatură numerică pe iPhone, acceptă virgulă sau punct. */
export function NumberField({ label, value, onChange, unit, error, hint, big = true, className = '', autoFocus, mode = 'decimal', placeholder }: NumberFieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field-input-row">
        <input
          id={id}
          className={big ? 'big' : ''}
          inputMode={mode}
          autoComplete="off"
          enterKeyHint="next"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
      {error ? (
        <span id={errId} className="field-error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  className?: string;
  type?: 'text' | 'datetime-local' | 'date';
  placeholder?: string;
  maxLength?: number;
}

export function TextField({ label, value, onChange, error, className = '', type = 'text', placeholder, maxLength }: TextFieldProps) {
  const id = useId();
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function SelectField<T extends string>({ label, value, options, onChange, className = '' }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ label, value, options, onChange, className = '' }: SegmentedProps<T>) {
  return (
    <div className={`seg ${className}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}
