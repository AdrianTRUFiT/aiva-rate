/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Navbar } from './ui/Navbar';
import { SystemFlow } from './ui/SystemFlow';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        <SystemFlow />
      </main>
      <footer className="py-8 border-t border-border text-center">
        <p className="text-xs text-muted uppercase tracking-widest font-bold">
          Governed System Architecture • Artifact-Based State Transitions
        </p>
      </footer>
    </div>
  );
}
