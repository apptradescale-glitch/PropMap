import { useRouter } from '@/routes/hooks';
import { Button } from '@/components/ui/button';
import React from 'react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="absolute left-1/2 top-1/2 mb-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-center">
      <span className="bg-gradient-to-b from-[#94bba3] to-[#94bba3] bg-clip-text text-[6rem] font-extrabold leading-none text-transparent">
       Tradescale
      </span>
      <h2 className="font-heading my-2 text-2xl font-bold">
       404
      </h2>
      <p>
        Page doesn&apos;t exist
      
      </p>
      <div className="mt-8 flex justify-center gap-2">
        <Button onClick={() => router.back()} variant="default" size="lg">
          Go back
        </Button>
        <Button onClick={() => router.push('/')} variant="ghost" size="lg">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
