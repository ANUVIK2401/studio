import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  text?: string;
  fullPage?: boolean;
}

export function LoadingState({ text = "Loading data...", fullPage = false }: LoadingStateProps) {
  const containerClasses = fullPage 
    ? "fixed inset-0 flex flex-col items-center justify-center bg-background/80 z-50"
    : "flex flex-col items-center justify-center py-12";
  
  return (
    <div className={containerClasses}>
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-foreground">{text}</p>
    </div>
  );
}