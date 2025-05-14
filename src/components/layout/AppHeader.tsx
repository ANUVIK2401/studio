import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="py-4 shadow-md bg-card/70 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-center px-4 sm:px-6 lg:px-8"> {/* Changed justify-between to justify-center */}
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary hover:text-primary/90 transition-colors">
          <TrendingUp className="h-8 w-8" />
          <span>StockVoyant</span>
        </Link>
        {/* Future navigation items can go here */}
      </div>
    </header>
  );
}
