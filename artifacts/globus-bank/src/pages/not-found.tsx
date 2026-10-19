import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="not-found-viewport">
      <Card className="w-full max-w-md mx-4 border-[#dce5e9] bg-[#fffefa] shadow-[0_18px_56px_rgba(23,47,72,.10)]">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 shrink-0 text-[#4a8b91]" />
            <h1 className="text-2xl font-bold text-[#203851]">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm leading-6 text-[#6e8091]">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
