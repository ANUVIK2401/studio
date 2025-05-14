import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

export function AppHeader() {
  return (
    <header className="py-4 shadow-sm">
      <div className="container mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-primary">
          <TrendingUp className="h-8 w-8" />
          <span>StockVoyant</span>
        </Link>
        {/* Future navigation items can go here */}
      </div>
    </header>
  );
}