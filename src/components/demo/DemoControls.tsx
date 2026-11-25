'use client';

import { DemoResetButton } from '@/components/DemoResetButton';
import { DemoProfileSelector } from '@/components/demo/DemoProfileSelector';

/** Punto único de entrada del selector de perfiles y del reinicio de la demo. */
export function DemoControls() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 pb-4">
      <DemoProfileSelector />
      <DemoResetButton />
    </div>
  );
}
