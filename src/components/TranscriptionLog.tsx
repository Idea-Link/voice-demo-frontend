import React, { useEffect, useRef } from 'react';
import { LogMessage } from '../types/conversation';

interface TranscriptionLogProps {
  logs: LogMessage[];
}

export const TranscriptionLog: React.FC<TranscriptionLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
        Waiting for conversation to start...
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 p-4 overflow-y-auto h-full custom-scrollbar">
      {logs.map((log, index) => (
        <div 
          key={index} 
          className={`flex flex-col ${log.role === 'user' ? 'items-end' : log.role === 'model' ? 'items-start' : 'items-center'}`}
        >
          {log.role === 'system' ? (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">{log.text}</span>
          ) : (
            <div 
              className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                log.role === 'user' 
                  ? 'bg-[#ff594e] text-white rounded-tr-none' 
                  : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
              }`}
            >
              {log.text}
            </div>
          )}
          <span className="text-[10px] text-slate-400 mt-1 px-1">
            {log.role === 'user' ? 'You' : log.role === 'model' ? 'Gemini' : ''}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};