import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Car,
  CheckCircle2,
  Info,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import { ToastMessage } from '../../hooks/useAppContext';
import {
  BookingStatus,
  IncidentPriority,
  IncidentStatus,
  VehicleListingStatus,
} from '../../types/models';

/* ============================================================================
 * 4. BUTTONS — Crisp rectangular radius (rounded-lg), consistent heights
 * ========================================================================== */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'danger'
    | 'ghost'
    | 'success'
    | 'amber';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none';

  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-[#0F766E] hover:bg-[#115E59] text-white focus:ring-[#0F766E]',
    secondary:
      'bg-zinc-900 hover:bg-zinc-800 text-white focus:ring-zinc-900',
    outline:
      'border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 focus:ring-zinc-400',
    danger:
      'bg-red-600 hover:bg-red-700 text-white focus:ring-red-600',
    success:
      'bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-emerald-700',
    amber:
      'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-600',
    ghost:
      'bg-transparent hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 focus:ring-zinc-400',
  };

  const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'text-xs px-3 h-8 gap-1.5',
    md: 'text-sm px-4 h-9 gap-2',
    lg: 'text-sm px-5 h-10 gap-2',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};

/* ============================================================================
 * 5. FORMS — Clean labels, standard inputs, clear validation states
 * ========================================================================== */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  leftAddon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  helperText,
  leftAddon,
  rightElement,
  className = '',
  id,
  ...props
}) => {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const subText = hint || helperText;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-zinc-700"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftAddon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            {leftAddon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 bg-white placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 ${
            leftAddon ? 'pl-9' : ''
          } ${rightElement ? 'pr-9' : ''} ${
            error
              ? 'border-red-400 focus:border-red-600 focus:ring-red-600/15'
              : 'border-zinc-300 focus:border-[#0F766E] focus:ring-[#0F766E]/15'
          } disabled:bg-zinc-100 disabled:text-zinc-500 ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400">
            {rightElement}
          </div>
        )}
      </div>
      {error ? (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        subText && <p className="text-xs text-zinc-500">{subText}</p>
      )}
    </div>
  );
};

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  hint,
  helperText,
  options,
  className = '',
  id,
  ...props
}) => {
  const selectId =
    id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const subText = hint || helperText;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium text-zinc-700"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 bg-white transition-colors focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-600 focus:ring-red-600/15'
            : 'border-zinc-300 focus:border-[#0F766E] focus:ring-[#0F766E]/15'
        } disabled:bg-zinc-100 disabled:text-zinc-500 ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        subText && <p className="text-xs text-zinc-500">{subText}</p>
      )}
    </div>
  );
};

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  hint,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const textareaId =
    id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const subText = hint || helperText;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-medium text-zinc-700"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-zinc-900 bg-white placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-600 focus:ring-red-600/15'
            : 'border-zinc-300 focus:border-[#0F766E] focus:ring-[#0F766E]/15'
        } disabled:bg-zinc-100 disabled:text-zinc-500 ${className}`}
        {...props}
      />
      {error ? (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        subText && <p className="text-xs text-zinc-500">{subText}</p>
      )}
    </div>
  );
};

/* ============================================================================
 * STATUS BADGES — Rectangular rounded-md badges with human-written labels
 * ========================================================================== */
type StatusType =
  | VehicleListingStatus
  | BookingStatus
  | IncidentStatus
  | IncidentPriority
  | string;

interface StatusBadgeProps {
  status: StatusType;
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  tone,
  size = 'md',
  className = '',
}) => {
  const normalized = String(status).toUpperCase();

  let colorClasses = 'bg-zinc-100 text-zinc-700 border-zinc-200';
  let label = String(status);

  if (tone) {
    if (tone === 'success') {
      colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    } else if (tone === 'warning') {
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
    } else if (tone === 'danger') {
      colorClasses = 'bg-red-50 text-red-800 border-red-200';
    } else if (tone === 'info') {
      colorClasses = 'bg-teal-50 text-teal-800 border-teal-200';
    } else {
      colorClasses = 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  } else {
    switch (normalized) {
      case 'AVAILABLE':
        colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        label = 'Available';
        break;
      case 'RETURNED':
      case 'COMPLETED':
        colorClasses = 'bg-zinc-100 text-zinc-700 border-zinc-200';
        label = 'Returned';
        break;
      case 'RESOLVED':
      case 'CLOSED':
      case 'APPROVED':
        colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        label =
          normalized === 'APPROVED'
            ? 'Approved'
            : normalized === 'CLOSED'
            ? 'Closed'
            : 'Resolved';
        break;
      case 'UPCOMING':
      case 'CONFIRMED':
        colorClasses = 'bg-teal-50 text-teal-800 border-teal-200';
        label = 'Upcoming';
        break;
      case 'ACTIVE':
        colorClasses = 'bg-teal-50 text-teal-800 border-teal-200';
        label = 'On trip';
        break;
      case 'PENDING_REVIEW':
      case 'OPEN':
      case 'UNDER_REVIEW':
      case 'MAINTENANCE':
      case 'HIGH':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        label =
          normalized === 'PENDING_REVIEW'
            ? 'Pending review'
            : normalized === 'UNDER_REVIEW'
            ? 'In review'
            : normalized === 'MAINTENANCE'
            ? 'In service'
            : normalized === 'HIGH'
            ? 'High priority'
            : 'Open';
        break;
      case 'RETURNED_LATE':
        colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        label = 'Returned late';
        break;
      case 'OVERDUE':
      case 'CRITICAL':
      case 'REJECTED':
        colorClasses = 'bg-red-50 text-red-800 border-red-200';
        label =
          normalized === 'CRITICAL'
            ? 'Critical'
            : normalized === 'REJECTED'
            ? 'Rejected'
            : 'Overdue';
        break;
      case 'DISABLED':
      case 'CANCELLED':
      case 'STANDARD':
        colorClasses = 'bg-zinc-100 text-zinc-600 border-zinc-200';
        label =
          normalized === 'DISABLED'
            ? 'Paused'
            : normalized === 'STANDARD'
            ? 'Standard'
            : 'Cancelled';
        break;
      default:
        label = String(status);
        break;
    }
  }

  const sizeStyles =
    size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${colorClasses} ${sizeStyles} ${className}`}
    >
      {label}
    </span>
  );
};

/* ============================================================================
 * VEHICLE IMAGE WITH FALLBACK
 * ========================================================================== */
interface VehicleImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export const VehicleImage: React.FC<VehicleImageProps> = ({
  src,
  alt,
  className = 'w-full h-48 object-cover',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    return (
      <div
        className={`bg-zinc-100 flex flex-col items-center justify-center text-zinc-400 p-4 ${className}`}
      >
        <Car className="w-8 h-8 mb-1.5 stroke-[1.5] text-zinc-400" />
        <span className="text-xs text-zinc-500 text-center line-clamp-1">
          {alt || 'Vehicle photo unavailable'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};

/* ============================================================================
 * MODAL DIALOG
 * ========================================================================== */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${maxWidthClass} bg-white rounded-xl shadow-lg border border-zinc-200 overflow-hidden my-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-zinc-200">
          <div>
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            {subtitle && (
              <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

/* ============================================================================
 * CONFIRMATION DIALOG
 * ========================================================================== */
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="space-y-5">
        <p className="text-sm text-zinc-600 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

/* ============================================================================
 * EMPTY, LOADING & ERROR STATES
 * ========================================================================== */
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center max-w-md mx-auto my-4">
      <div className="w-10 h-10 rounded-lg bg-zinc-100 text-zinc-600 flex items-center justify-center mx-auto mb-3">
        {icon || <Car className="w-5 h-5 stroke-[1.75]" />}
      </div>
      <h3 className="text-sm font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => (
  <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center max-w-md mx-auto my-6">
    <Loader2 className="w-6 h-6 text-[#0F766E] animate-spin mx-auto mb-3" />
    <p className="text-xs font-medium text-zinc-600">{message}</p>
  </div>
);

interface ErrorStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load view',
  message,
  actionLabel = 'Go back',
  onAction,
  onRetry,
}) => {
  const handler = onAction || onRetry;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center max-w-md mx-auto my-6 space-y-3">
      <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="text-xs text-zinc-500 leading-relaxed">{message}</p>
      {handler && (
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={handler}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * TOAST NOTIFICATIONS CONTAINER
 * ========================================================================== */
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          error: <XCircle className="w-4 h-4 text-red-600 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          info: <Info className="w-4 h-4 text-teal-700 shrink-0" />,
        };

        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg shadow-md border border-zinc-200 bg-white text-zinc-900"
          >
            <div className="mt-0.5">{iconMap[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900">{t.title}</p>
              {t.message && (
                <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
