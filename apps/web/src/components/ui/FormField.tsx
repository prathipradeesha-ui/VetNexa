import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';

interface FieldWrapperProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}

/** Label, hint and error message laid out consistently around any input. */
export function FieldWrapper({ id, label, error, hint, optional, children }: FieldWrapperProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} {optional && <span className="field__optional">(optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`}>
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </span>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

/**
 * Text input connected to its label and messages through ids, so screen readers read
 * the hint or error together with the field. Works with react-hook-form's register().
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, optional, id, className = '', type = 'text', ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const input = (
    <input
      ref={ref}
      id={inputId}
      type={isPassword && showPassword ? 'text' : type}
      className={`input ${className}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );

  return (
    <FieldWrapper id={inputId} label={label} error={error} hint={hint} optional={optional}>
      {isPassword ? (
        <div className="password-wrap">
          {input}
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      ) : (
        input
      )}
    </FieldWrapper>
  );
});
