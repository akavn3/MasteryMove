import { useState } from 'react';
import { SessionStats } from '../types';
import { Sparkles, Trophy, Flame, Play, Clock, CheckCircle2, ChevronRight, BrainCircuit, RefreshCw } from 'lucide-react';

interface AISummaryProps {
  sessionStats: SessionStats | null;
  onRestartPractice: () => void;
}

// Built-in simple & secure markdown tag parser
function BiomechanicalMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-4 text-sm text-slate-300 leading-relaxed font-sans">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Headers
        if (trimmed.startsWith('###')) {
          return (
            <h4 key={idx} className="text-sm font-black text-white uppercase tracking-wider border-b border-slate-800 pb-1.5 pt-4 flex items-center gap-1.5 font-sans">
              <span className="w-1.5 h-3.5 bg-sky-500 rounded-sm" />
              {trimmed.replace('###', '').trim()}
            </h4>
          );
        }
        if (trimmed.startsWith('##')) {
          return (
            <h3 key={idx} className="text-base font-extrabold text-sky-400 pt-5 flex items-center gap-2">
              {trimmed.replace('##', '').trim()}
            </h3>
          );
        }
        if (trimmed.startsWith('#')) {
          return (
            <h2 key={idx} className="text-lg font-black text-white uppercase tracking-tight py-4">
              {trimmed.replace('#', '').trim()}
            </h2>
          );
        }

        // Bullet lists
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.slice(1).trim();
          return (
            <div key={idx} className="flex gap-2.5 pl-2">
              <ChevronRight className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p className="opacity-90">{parseBoldText(content)}</p>
            </div>
          );
        }

        // Numbered lists
        if (/^\d+\./.test(trimmed)) {
          const match = trimmed.match(/^(\d+)\.(.*)/);
          if (match) {
            return (
              <div key={idx} className="flex gap-2.5 pl-1.5">
                <span className="text-sky-400 font-bold font-mono">{match[1]}.</span>
                <p className="opacity-90">{parseBoldText(match[2].trim())}</p>
              </div>
            );
          }
        }

        // Ordinary Paragraphs
        if (trimmed === '') return <div key={idx} className="h-1.5" />;
        return <p key={idx} className="opacity-90">{parseBoldText(trimmed)}</p>;
      })}
    </div>
  );
}

// Inline Bold matcher
function parseBoldText(text: string) {
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="text-white font-bold">{part}</strong>;
    }
    return part;
  });
}

export default function AISummary({ sessionStats, onRestartPractice }: AISummaryProps) {
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorFlag, setErrorFlag] = useState<string | null>(null);

  const fetchAIReport = async () => {
    if (!sessionStats) return;
    setLoading(true);
    setErrorFlag(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionStats)
      });

      const data = await response.json();
      if (data && data.success) {
        setAiReport(data.feedback);
      } else {
        throw new Error(data.error || "Coaching API returned an empty response.");
      }
    } catch (err: any) {
      console.error("AI Coach fetch error:", err);
      setErrorFlag(err.message || "Failed to establish secure communications with Coach Apex.");
    } finally {
      setLoading(false);
    }
  };

  if (!sessionStats) return null;

  return (
    <div className="w-full flex flex-col gap-6 max-w-4xl mx-auto py-2 animate-fadeIn">
      {/* 1. Header Banner */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden flex flex-col md:flex-row gap-6 items-center justify-between shadow-2xl">
        <div className="absolute top-0 right-0 p-5 opacity-5 pointer-events-none">
          <Trophy className="w-48 h-48 text-sky-400" />
        </div>

        <div className="flex gap-4.5 items-center flex-col md:flex-row text-center md:text-left">
          <div className="p-4 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-100 tracking-tight font-sans">
              Precision Movement Complete!
            </h2>
            <p className="text-slate-400 text-xs mt-1 leading-relaxed">
              Form telemetry collected successfully. You can now request your generative performance metrics appraisal.
            </p>
          </div>
        </div>

        <button
          onClick={onRestartPractice}
          className="flex items-center gap-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 px-5 py-3 rounded-xl font-extrabold text-sm transition-all focus:ring-4 focus:ring-sky-500/20 shadow-lg cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Play className="w-4 h-4 fill-current" />
          Start Next Drill
        </button>
      </div>

      {/* 2. Scorecard Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric A */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Active Exercise
          </span>
          <div>
            <p className="text-2xl font-black text-slate-100 tracking-tight">{sessionStats.exercise}</p>
            <p className="text-[11px] text-slate-400 mt-1">Movement profile</p>
          </div>
        </div>

        {/* Metric B */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Mechanical Reps
          </span>
          <div>
            <p className="text-3xl font-black text-white font-mono">{sessionStats.repCount}</p>
            <p className="text-[11px] text-slate-400 mt-1">Form lock counts</p>
          </div>
        </div>

        {/* Metric C */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            Accuracy Score
          </span>
          <div>
            <p className="text-3xl font-black text-sky-400 font-mono">{sessionStats.precisionScore}%</p>
            <p className="text-[11px] text-slate-400 mt-1">Angle compliance</p>
          </div>
        </div>

        {/* Metric D */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Clock className="w-3.5 h-3.5 text-violet-400" />
            Time Elapsed
          </span>
          <div>
            <p className="text-3xl font-black text-white font-mono">{sessionStats.duration}s</p>
            <p className="text-[11px] text-slate-400 mt-1">Tempo execution</p>
          </div>
        </div>
      </div>

      {/* 3. AI Coach Apex Report Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6.5 shadow-2xl flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-slate-850 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shadow-inner">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-sans">Coach Apex Bio-mechanics Report</h3>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">Generative movement refinement strategy & corrective action plan</p>
            </div>
          </div>

          {!aiReport && !loading && (
            <button
              onClick={fetchAIReport}
              className="flex items-center gap-2.5 bg-indigo-500 hover:bg-indigo-400 font-bold text-xs uppercase tracking-wider max-sm:w-full justify-center text-slate-950 px-5.5 py-3 rounded-xl transition-all cursor-pointer shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Coach Evaluation
            </button>
          )}
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mb-4" />
            <h4 className="font-semibold text-slate-200">Coach Apex is compiling your logs...</h4>
            <p className="text-slate-400 text-xs mt-1 max-w-sm leading-relaxed">
              Reviewing angular peaks, symmetry deltas, joint loads, and compiling biomechanical advice. Just a moment.
            </p>
          </div>
        )}

        {/* Error message */}
        {errorFlag && (
          <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs font-sans">
            <p className="font-bold mb-1">Coaching Link Error</p>
            <p className="opacity-90">{errorFlag}</p>
            <button
              onClick={fetchAIReport}
              className="mt-3 bg-red-800 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-[10px] px-3.5 py-2 rounded-lg cursor-pointer"
            >
              Retry Uplink
            </button>
          </div>
        )}

        {/* Report Markdown Area */}
        {aiReport && !loading && !errorFlag && (
          <div className="bg-slate-950/60 border border-slate-850 p-5 md:p-6 rounded-2xl max-h-[500px] overflow-y-auto">
            <BiomechanicalMarkdown text={aiReport} />
          </div>
        )}

        {/* Prompt/CTA when report hasn't been requested yet */}
        {!aiReport && !loading && !errorFlag && (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
              Your mechanical telemetry logs are loaded. Unlock premium coaching insights by initiating Coach Apex's generative biomechanics algorithm up top.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
