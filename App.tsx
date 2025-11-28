import React, { useState, Suspense, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import ParticleScene from './components/ParticleScene';
import { Settings, RotateCcw } from 'lucide-react';

// Icons
const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
);
const IconPause = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
);

const THEMES = [
  { name: 'Cyan', color: '#4cc9f0' },
  { name: 'Neon Green', color: '#39ff14' },
  { name: 'Hot Pink', color: '#ff007f' },
  { name: 'Gold', color: '#ffd700' },
  { name: 'Electric Violet', color: '#8b5cf6' },
];

const App: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [activeText, setActiveText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isMorphing, setIsMorphing] = useState(false);
  
  // Settings
  const [activeColor, setActiveColor] = useState(THEMES[0].color);
  const [particleCount, setParticleCount] = useState(8000);
  const [showSettings, setShowSettings] = useState(false);
  const [autoCycle, setAutoCycle] = useState(false);

  // Auto-cycle effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoCycle) {
      interval = setInterval(() => {
        setActiveColor((prev) => {
          const currentIndex = THEMES.findIndex(t => t.color === prev);
          // If current color isn't in themes (unlikely), start at 0
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEMES.length;
          return THEMES[nextIndex].color;
        });
      }, 4000); // Cycle every 4 seconds
    }
    return () => clearInterval(interval);
  }, [autoCycle]);

  const handleMorph = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length > 0) {
      setActiveText(inputValue);
      setIsMorphing(true);
    }
  }, [inputValue]);

  const handleReset = useCallback(() => {
    setIsMorphing(false);
    setActiveText('');
    setInputValue('');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isMorphing) {
          // If already morphing and user types new text and hits enter, update text
          // If input is empty, reset
          if (inputValue.trim().length > 0) handleMorph();
          else handleReset();
      } else {
          handleMorph();
      }
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 12], fov: 45 }}
          gl={{ 
            antialias: true, 
            alpha: true, // Allow transparency to prevent potential composer clearing issues
            powerPreference: "high-performance"
          }}
          dpr={[1, 2]} 
        >
          <color attach="background" args={['#050510']} />
          {/* Use a fog to help blend the glow distance */}
          <fog attach="fog" args={['#050510', 10, 25]} />
          
          <ambientLight intensity={0.5} />
          
          <Suspense fallback={null}>
            <ParticleScene 
              text={activeText} 
              isMorphing={isMorphing} 
              isPaused={isPaused} 
              color={activeColor}
              particleCount={particleCount}
            />
            <EffectComposer>
              <Bloom 
                luminanceThreshold={0.2} 
                luminanceSmoothing={0.9} 
                height={300} 
                intensity={1.2} 
              />
            </EffectComposer>
          </Suspense>
          
          <OrbitControls 
            enableZoom={true} 
            enablePan={false} 
            rotateSpeed={0.5} 
            minDistance={5}
            maxDistance={20}
          />
        </Canvas>
      </div>

      {/* Watermark */}
      <div className="absolute bottom-6 right-6 z-20 pointer-events-none opacity-40 font-mono text-[10px] tracking-[0.2em] text-white select-none">
        DESIGNED BY SHIVANSHU
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6">
        
        {/* Header */}
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-xl shadow-lg">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              Particle Morph 3D
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
              Type text below to transform the 3D sphere.
            </p>
          </div>
          
          <div className="flex gap-2">
              {/* Settings Toggle */}
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`flex items-center justify-center w-12 h-12 rounded-full backdrop-blur border transition-all text-white ${showSettings ? 'bg-white/20 border-white/40' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
                title="Settings"
              >
                <Settings size={20} />
              </button>
              
              {/* Pause Toggle */}
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 transition-all text-white"
                title={isPaused ? "Resume" : "Pause"}
              >
                {isPaused ? <IconPlay /> : <IconPause />}
              </button>
          </div>
        </header>

        {/* Settings Panel (Conditional) */}
        {showSettings && (
            <div className="pointer-events-auto absolute top-24 right-6 bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-xl shadow-2xl w-72 animate-in fade-in slide-in-from-top-4 duration-200 z-50">
                <div className="mb-5">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Theme Color</h3>
                    
                    {/* Auto Cycle Toggle */}
                    <div className="flex items-center gap-2">
                       <label htmlFor="auto-cycle" className="text-[10px] text-gray-400 cursor-pointer select-none">AUTO CYCLE</label>
                       <button 
                         id="auto-cycle"
                         onClick={() => setAutoCycle(!autoCycle)}
                         className={`w-8 h-4 rounded-full relative transition-colors ${autoCycle ? 'bg-cyan-500' : 'bg-white/20'}`}
                       >
                         <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${autoCycle ? 'translate-x-4' : 'translate-x-0'}`} />
                       </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                      {THEMES.map((theme) => (
                          <button
                              key={theme.name}
                              onClick={() => {
                                setActiveColor(theme.color);
                                setAutoCycle(false); // Manually selecting disables auto cycle
                              }}
                              className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${activeColor === theme.color ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'border-transparent'}`}
                              style={{ backgroundColor: theme.color }}
                              title={theme.name}
                          />
                      ))}
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Particle Count</h3>
                    <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">{particleCount}</span>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max="20000"
                    step="500"
                    value={particleCount}
                    onChange={(e) => setParticleCount(Number(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-colors"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1 font-mono">
                    <span>1k</span>
                    <span>20k</span>
                  </div>
                </div>
            </div>
        )}

        {/* Bottom Controls */}
        <div className="w-full max-w-lg mx-auto pointer-events-auto pb-4 sm:pb-8">
           <div className={`glass-panel p-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 flex gap-2 items-center focus-within:border-white/30 focus-within:shadow-cyan-900/40 ${isMorphing ? 'shadow-purple-900/20' : 'shadow-cyan-900/20'}`}>
             <input
               type="text"
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={handleKeyDown}
               placeholder={isMorphing ? "Type to change..." : "Type something..."}
               maxLength={20}
               className="flex-1 bg-transparent border-none outline-none text-white px-4 py-3 text-lg placeholder-gray-500 font-medium"
             />
             
             {isMorphing ? (
                 <button
                   onClick={handleReset}
                   className="bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-xl transition-all flex items-center gap-2 group border border-white/10"
                   title="Reset to Sphere"
                 >
                   <RotateCcw size={18} className="group-hover:-rotate-180 transition-transform duration-500" />
                 </button>
             ) : (
                 <button
                   onClick={handleMorph}
                   className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-95"
                 >
                   Morph
                 </button>
             )}
           </div>
           
           <div className="text-center mt-3 opacity-60 text-xs font-mono">
             {isPaused ? "ANIMATION PAUSED" : `${isMorphing ? "TEXT MODE" : "SPHERE MODE"}`}
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;