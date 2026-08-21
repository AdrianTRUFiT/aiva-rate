import { useState } from 'react';
import { Navbar, type View } from './ui/Navbar';
import { SessionFlow } from './ui/SessionFlow';
import { Console } from './console/Console';

export default function App() {
  const [view, setView] = useState<View>('session');

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar view={view} onView={setView} />
      <main className="flex-grow">
        {view === 'session' ? <SessionFlow /> : <Console />}
      </main>
      <footer className="py-8 px-6 border-t border-border">
        <p className="max-w-5xl mx-auto text-xs text-muted">
          Performance Wellness is not therapy, counselling, or medical care. Every guide is an AI.
          If you are in crisis, contact your local emergency number or a crisis line —{' '}
          <a
            href="https://findahelpline.com"
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2 hover:text-body"
          >
            findahelpline.com
          </a>{' '}
          lists them by country.
        </p>
      </footer>
    </div>
  );
}
