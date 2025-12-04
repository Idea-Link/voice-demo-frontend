import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Visualizer } from './components/Visualizer';
import { TranscriptionLog } from './components/TranscriptionLog';
import { LiveManager } from './services/liveManager';
import { ConnectionState, LogMessage } from './types/conversation';
import logo from './logo.svg';
 
interface AppProps {
  appRoute?: string;
}

function App({ appRoute }: AppProps) {
  const [state, setState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [volume, setVolume] = useState(0);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  
  const liveManagerRef = useRef<LiveManager | null>(null);

  const addLog = useCallback((role: 'user' | 'model' | 'system', text: string) => {
    setLogs(prev => [...prev, { role, text, timestamp: new Date() }]);
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (liveManagerRef.current) {
      await liveManagerRef.current.disconnect();
    }
    setState(ConnectionState.DISCONNECTED);
    setVolume(0);
  }, []);

  const handleConnect = useCallback(async () => {
    setState(ConnectionState.CONNECTING);
    setLogs([]); // Clear logs on new session

    const manager = new LiveManager({
      onLog: addLog,
      onError: (err) => {
        console.error(err);
        addLog('system', `Error: ${err}`);
        setState(ConnectionState.ERROR);
      },
      onClose: () => {
        setState(ConnectionState.DISCONNECTED);
        setVolume(0);
      },
      onVolumeUpdate: (input, output) => {
        setVolume(output); // Visualize the model's output primarily
      }
    }, {
      appRoute
    });

    liveManagerRef.current = manager;
    await manager.connect();
    setState(ConnectionState.CONNECTED);
  }, [addLog, appRoute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveManagerRef.current) {
        // Fire and forget - cleanup happens anyway
        liveManagerRef.current.disconnect().catch(err => {
          console.error('Error during cleanup disconnect:', err);
        });
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#ff594e]/30 flex flex-col relative overflow-hidden">
      
      {/* Header / Title */}
      <div className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col items-center justify-center">
          <img src={logo} alt="IdeaLink Logo" className="w-30 h-30" />
          <p className="text-slate-500 text-sm mt-1 font-light">Voice AI Assistant</p>
        </div>
        
        {/* Connection Status Tag */}
        <div className={`pointer-events-auto inline-flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase border backdrop-blur-md transition-all ${
            state === ConnectionState.CONNECTED ? 'border-green-500/30 bg-green-50 text-green-600 shadow-sm' :
            state === ConnectionState.CONNECTING ? 'border-yellow-500/30 bg-yellow-50 text-yellow-600' :
            'border-slate-200 bg-slate-100 text-slate-500'
         }`}>
            <span className={`block w-2 h-2 rounded-full ${
              state === ConnectionState.CONNECTED ? 'bg-green-500 animate-pulse' :
              state === ConnectionState.CONNECTING ? 'bg-yellow-500 animate-pulse' :
              'bg-slate-400'
            }`}></span>
            <span>{state}</span>
         </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Central Start Button (Only when disconnected) */}
        {state === ConnectionState.DISCONNECTED || state === ConnectionState.ERROR ? (
          <div className="z-30 text-center">
            <button
              onClick={handleConnect}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-[#ff594e] rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ff594e] hover:bg-[#e0483e] hover:scale-105 hover:shadow-[0_0_30px_rgba(255,89,78,0.4)]"
            >
              <span className="mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </span>
              Pradėti pokalbį
            </button>
            <p className="mt-4 text-slate-400 text-sm max-w-xs mx-auto">
              Click to speak with IdeaLink AI.
            </p>
          </div>
        ) : null}

        <div className={`absolute inset-0 transition-opacity duration-700 ${state === ConnectionState.CONNECTED ? 'opacity-100' : 'opacity-30 blur-sm grayscale'}`}>
          <Visualizer volume={volume} isActive={state === ConnectionState.CONNECTED} />
        </div>
      </div>

      {/* Bottom Controls & Transcript */}
      <div className="relative z-20 w-full max-w-3xl mx-auto pb-6 px-4 flex flex-col items-center justify-end space-y-4 min-h-[200px]">
        
        {/* Disconnect Button (Floating at bottom when connected) */}
        {(state === ConnectionState.CONNECTED || state === ConnectionState.CONNECTING) && (
           <button
            onClick={handleDisconnect}
            className="mb-4 px-6 py-3 bg-white border border-[#ff594e]/30 text-[#ff594e] rounded-full font-medium shadow-lg backdrop-blur-sm transition-all flex items-center space-x-2 hover:bg-[#ff594e]/5 hover:shadow-xl"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>End Session</span>
          </button>
        )}

      </div>

    </div>
  );
}

export default App;