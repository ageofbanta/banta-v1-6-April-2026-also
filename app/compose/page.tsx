import { Suspense } from 'react';
import ComposeClient from './ComposeClient';

export default function ComposePage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
          <h1>Loading compose…</h1>
        </main>
      }
    >
      <ComposeClient />
    </Suspense>
  );
}
