import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

const TOAST_AUTO_DISMISS_MS = 5000;
const ERROR_TOAST_AUTO_DISMISS_MS = 10000;

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const duration = props.duration
          ?? (props.variant === 'destructive' ? ERROR_TOAST_AUTO_DISMISS_MS : TOAST_AUTO_DISMISS_MS);
        return (
          <Toast key={id} {...props} duration={duration}>
            <div className="grid gap-1 min-w-0">
              {title && <ToastTitle className="break-words">{title}</ToastTitle>}
              {description && <ToastDescription className="break-words">{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
