import React from 'react';

interface KnowledgeBaseProps {
  value: string;
  onChange: (val: string) => void;
  disabled: boolean;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="w-full max-w-md mx-auto bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col h-64 sm:h-80 transition-all">
      <label className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 flex justify-between items-center">
        <span>Provided Knowledge</span>
        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300">Only Source of Truth</span>
      </label>
      <textarea
        className="flex-1 bg-slate-900 text-slate-200 p-3 rounded-lg border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none resize-none text-sm leading-relaxed custom-scrollbar transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="Paste the text you want the AI to know about here. For example: 'The company policy states that...'"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <p className="text-xs text-slate-500 mt-2">
        The AI will STRICTLY refuse to answer questions outside of this text.
      </p>
    </div>
  );
};