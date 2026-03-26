import React from 'react';
import { useSystemStore } from '../state/systemStore';
import { CapturedSignal, VerifiedOpportunity, Artifact } from '../types';
import { Terminal, Zap, Activity, ShieldCheck, User, Clock, Fingerprint, ArrowRight, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { cn } from '../lib/utils';

const SoulmarkBadge = ({ artifact }: { artifact: Artifact | undefined }) => {
  if (!artifact?.soulmark) return null;
  return (
    <div className="flex items-center space-x-1.5 text-[10px] font-mono text-muted/60 bg-surface-muted px-2 py-1 rounded border border-border/50">
      <ShieldCheck size={10} className="text-primary/60" />
      <span>Verified record created • Traceable system state established</span>
    </div>
  );
};

export const Delivery = () => {
  const { artifacts, reset } = useSystemStore();
  const signal = artifacts.ENTRY as CapturedSignal;
  const opportunity = artifacts.QUALIFICATION as VerifiedOpportunity;

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-16 px-6">
      {/* Header Section */}
      <div className="space-y-6 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <Search size={14} />
          <span>Analysis Complete</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-heading tracking-tight leading-tight max-w-2xl mx-auto">
          Here's what's actually happening in your situation
        </h1>
        <p className="text-lg text-body max-w-xl mx-auto">
          We've analyzed your input and mapped the underlying structure of your challenge.
        </p>
      </div>

      {/* The Reframe Card */}
      <div className="card p-10 bg-primary text-white border-none shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
          <Zap size={120} />
        </div>
        <div className="relative z-10 space-y-4">
          <p className="text-primary-dim font-bold uppercase tracking-widest text-xs">The Core Shift</p>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight">
            You're not losing money because of billing. <br />
            <span className="text-white/70">You're losing visibility into your billing.</span>
          </h2>
        </div>
      </div>

      {/* Clarity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* What we see right now */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-primary shadow-sm">
              <Search size={20} />
            </div>
            <h3 className="text-xl font-bold text-heading">What we see right now</h3>
          </div>
          <div className="card p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                <p className="text-body leading-relaxed">
                  <span className="font-bold text-heading">Active Intent:</span> {signal?.data.rawInput}
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
                <p className="text-body leading-relaxed">
                  <span className="font-bold text-heading">Qualification Depth:</span> {opportunity?.data.qualificationScore}% alignment with target state.
                </p>
              </div>
            </div>
            <SoulmarkBadge artifact={signal} />
          </div>
        </div>

        {/* What this creates */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-warning shadow-sm">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-xl font-bold text-heading">What this creates</h3>
          </div>
          <div className="card p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
                <p className="text-body">Money gets delayed in the process.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
                <p className="text-body">Some revenue never gets collected at all.</p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-2 shrink-0" />
                <p className="text-body">You don't have a clear financial position at any moment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What needs to be fixed */}
      <div className="space-y-8">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-primary shadow-sm">
            <Zap size={20} />
          </div>
          <h3 className="text-xl font-bold text-heading">What needs to be fixed next</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunity?.data.requirements.map((req, i) => (
            <div key={i} className="card p-5 flex items-start space-x-4 hover:border-primary/40 transition-all group">
              <div className="w-8 h-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center text-sm font-bold shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                {i + 1}
              </div>
              <p className="text-body font-medium leading-snug">{req}</p>
            </div>
          ))}
        </div>
        <SoulmarkBadge artifact={opportunity} />
      </div>

      {/* System Truth (Quiet) */}
      <div className="pt-12 border-t border-border space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-heading">What just happened (quietly, behind the scenes)</h4>
            <p className="text-xs text-muted">Your situation was analyzed and a structured starting state was created.</p>
          </div>
          <div className="flex items-center space-x-2">
            {['ENTRY', 'ACQUISITION', 'STABILIZATION', 'QUALIFICATION', 'ROUTING', 'DELIVERY'].map((s) => (
              <div 
                key={s} 
                className={cn(
                  "w-2 h-2 rounded-full",
                  artifacts[s as any] ? "bg-primary" : "bg-surface-muted"
                )} 
                title={s}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60 hover:opacity-100 transition-opacity">
          {Object.entries(artifacts).map(([stage, artifact]) => (
            artifact?.soulmark && (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-muted">
                  <span>{stage}</span>
                  <ShieldCheck size={10} className="text-primary" />
                </div>
                <div className="p-3 bg-surface-muted rounded-lg border border-border/50 space-y-2">
                  <div className="flex items-center justify-between text-[9px] font-mono text-muted/80">
                    <div className="flex items-center space-x-1">
                      <User size={8} />
                      <span>{artifact.soulmark.authorship}</span>
                    </div>
                    <span>{new Date(artifact.soulmark.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[8px] font-mono text-muted/40 truncate">
                    <Fingerprint size={8} />
                    <span>{artifact.soulmark.signature}</span>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Final CTA */}
      <div className="text-center space-y-6 pt-8">
        <p className="text-body italic">
          You're no longer operating from guesswork. You now have a defined position.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="btn-primary flex items-center space-x-2 group">
            <span>Let's turn this into a working system</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button onClick={reset} className="btn-secondary text-xs">Initialize New Signal</button>
        </div>
      </div>
    </div>
  );
};
