import { useState, useEffect, useRef } from 'react';
import { ExerciseType, Landmark } from '../types';
import { Target, Shield, HeartPulse, Sparkles, ChevronRight, RotateCcw, AlertTriangle, Activity, Cpu, Layers } from 'lucide-react';
import { calculateAngle } from '../utils';

interface MetricsPanelProps {
  exercise: ExerciseType;
  precisionScore: number;
  symmetryScore: number;
  postureScore: number;
  tolerance: 'Elite' | 'Pro' | 'Recreation';
  setTolerance: (val: 'Elite' | 'Pro' | 'Recreation') => void;
  formErrors: {
    elbowFlare: number;
    poorDepth: number;
    asymmetry: number;
    forwardLean: number;
  };
  setFormErrors: (updater: any) => void;
  isSimulated: boolean;
  onResetCalibration: () => void;
  liveComments: string[];
  landmarks: Landmark[];
  faceLandmarks: Landmark[];
  leftHandLandmarks: Landmark[];
  rightHandLandmarks: Landmark[];
}

export default function MetricsPanel({
  exercise,
  precisionScore,
  symmetryScore,
  postureScore,
  tolerance,
  setTolerance,
  formErrors,
  setFormErrors,
  isSimulated,
  onResetCalibration,
  liveComments,
  landmarks,
  faceLandmarks,
  leftHandLandmarks,
  rightHandLandmarks
}: MetricsPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the real-time coaching terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveComments]);

  const handleSliderChange = (field: string, value: number) => {
    setFormErrors((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const getToleranceDegrees = () => {
    if (tolerance === 'Elite') return 10;
    if (tolerance === 'Pro') return 18;
    return 26;
  };

  // Compute live simultaneous Holistic channel readings
  const getHolisticreadings = () => {
    if (!landmarks || landmarks.length < 29) {
      return {
        leftKnee: 180,
        rightKnee: 180,
        leftElbow: 180,
        rightElbow: 180,
        leftPinch: 0,
        rightPinch: 0,
        faceSymmetry: 100,
        headTilt: 0,
      };
    }

    const leftKnee = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
    const rightKnee = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
    const leftElbow = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
    const rightElbow = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);

    // Real finger pinch if leftHandLandmarks are listed
    let leftPinch = 0;
    if (leftHandLandmarks && leftHandLandmarks.length >= 21) {
      const thumbTip = leftHandLandmarks[4];
      const indexTip = leftHandLandmarks[8];
      if (thumbTip && indexTip) {
        const dist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
        leftPinch = Math.max(0, Math.min(100, Math.round(100 * (1 - (dist - 0.015) / 0.065))));
      }
    } else {
      const lThumb = landmarks[21], lIndex = landmarks[19];
      if (lThumb && lIndex) {
        const dist = Math.sqrt(Math.pow(lThumb.x - lIndex.x, 2) + Math.pow(lThumb.y - lIndex.y, 2));
        leftPinch = Math.max(0, Math.min(100, Math.round(100 * (1 - (dist - 0.015) / 0.065))));
      }
    }

    // Real finger pinch if rightHandLandmarks are listed
    let rightPinch = 0;
    if (rightHandLandmarks && rightHandLandmarks.length >= 21) {
      const thumbTip = rightHandLandmarks[4];
      const indexTip = rightHandLandmarks[8];
      if (thumbTip && indexTip) {
        const dist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
        rightPinch = Math.max(0, Math.min(100, Math.round(100 * (1 - (dist - 0.015) / 0.065))));
      }
    } else {
      const rThumb = landmarks[22], rIndex = landmarks[20];
      if (rThumb && rIndex) {
        const dist = Math.sqrt(Math.pow(rThumb.x - rIndex.x, 2) + Math.pow(rThumb.y - rIndex.y, 2));
        rightPinch = Math.max(0, Math.min(100, Math.round(100 * (1 - (dist - 0.015) / 0.065))));
      }
    }

    // Real face mapping if faceLandmarks are listed
    let headTilt = 0;
    let faceSymmetry = 100;
    if (faceLandmarks && faceLandmarks.length > 250) {
      const lTemple = faceLandmarks[234];
      const rTemple = faceLandmarks[454];
      if (lTemple && rTemple) {
        headTilt = Math.round(Math.abs(lTemple.y - rTemple.y) * 450);
      }
      const noseTip = faceLandmarks[1];
      const lEyeOuter = faceLandmarks[33];
      const rEyeOuter = faceLandmarks[263];
      if (noseTip && lEyeOuter && rEyeOuter) {
        const eyeYDiff = Math.abs((lEyeOuter.y - noseTip.y) - (rEyeOuter.y - noseTip.y));
        faceSymmetry = Math.max(10, Math.round(100 - eyeYDiff * 850));
      }
    } else {
      const lEar = landmarks[7], rEar = landmarks[8];
      headTilt = lEar && rEar ? Math.round(Math.abs(lEar.y - rEar.y) * 450) : 0;

      const lEye = landmarks[2], rEye = landmarks[5], nose = landmarks[0];
      if (nose && lEye && rEye) {
        const eyeYDiff = Math.abs((lEye.y - nose.y) - (rEye.y - nose.y));
        faceSymmetry = Math.max(10, Math.round(100 - eyeYDiff * 850));
      }
    }

    return {
      leftKnee,
      rightKnee,
      leftElbow,
      rightElbow,
      leftPinch,
      rightPinch,
      faceSymmetry,
      headTilt
    };
  };

  const hr = getHolisticreadings();

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      {/* 1. Dynamic Circular Gauges */}
      <div id="stats_gauges_grid" className="grid grid-cols-3 gap-3.5">
        {/* Precision Circle */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-md">
          <div className="relative flex items-center justify-center w-16 h-16 mb-2">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(30, 41, 59, 0.9)" strokeWidth="4.5" fill="none" />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#0ea5e9"
                strokeWidth="5"
                strokeDasharray={28 * 2 * Math.PI}
                strokeDashoffset={28 * 2 * Math.PI * (1 - precisionScore / 100)}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-sm font-black text-white font-mono">{precisionScore}%</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Precision</span>
        </div>

        {/* Symmetry Circle */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-md">
          <div className="relative flex items-center justify-center w-16 h-16 mb-2">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(30, 41, 59, 0.9)" strokeWidth="4.5" fill="none" />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#10b981"
                strokeWidth="5"
                strokeDasharray={28 * 2 * Math.PI}
                strokeDashoffset={28 * 2 * Math.PI * (1 - symmetryScore / 100)}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-sm font-black text-white font-mono">{symmetryScore}%</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Symmetry</span>
        </div>

        {/* Posture Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center justify-center text-center shadow-md">
          <div className="relative flex items-center justify-center w-16 h-16 mb-2">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="rgba(30, 41, 59, 0.9)" strokeWidth="4.5" fill="none" />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#f59e0b"
                strokeWidth="5"
                strokeDasharray={28 * 2 * Math.PI}
                strokeDashoffset={28 * 2 * Math.PI * (1 - postureScore / 100)}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-sm font-black text-white font-mono">{postureScore}%</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Posture</span>
        </div>
      </div>

      {/* 2. MediaPipe Holistic Simultaneous Channel Monitor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-md">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-100 flex items-center gap-1.5 font-sans">
            <Layers className="w-4 h-4 text-fuchsia-400 animate-pulse" />
            MediaPipe Holistic Trackers
          </h3>
          <span className="text-[9px] font-black uppercase bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5 animate-spin-slow text-fuchsia-400" />
            Multi-Sensor Live
          </span>
        </div>

        <p className="text-slate-400 text-xs mb-3.5 leading-relaxed">
          Concurrent sensor capture tracks body pose, hand gestures, and facial mapping in a single semantically unified model.
        </p>

        <div className="flex flex-col gap-2.5">
          {/* Pose Matrix Monitor */}
          <div className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
                POSE CHANNEL
              </span>
              <span className="text-[10px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mt-1">
              <div>
                Knees: <strong className="text-slate-200">{hr.leftKnee}° / {hr.rightKnee}°</strong>
              </div>
              <div>
                Elbows: <strong className="text-slate-200">{hr.leftElbow}° / {hr.rightElbow}°</strong>
              </div>
            </div>
          </div>

          {/* Hands Matrix Monitor */}
          <div className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                HAND PARTS CHANNEL
              </span>
              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-500/20">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mt-1">
              <div>
                L Pinch: <span className={`font-bold ${hr.leftPinch > 80 ? 'text-emerald-400' : 'text-slate-200'}`}>{hr.leftPinch}%</span>
              </div>
              <div>
                R Pinch: <span className={`font-bold ${hr.rightPinch > 80 ? 'text-emerald-400' : 'text-slate-200'}`}>{hr.rightPinch}%</span>
              </div>
            </div>
          </div>

          {/* Face Matrix Monitor */}
          <div className="bg-slate-950/70 border border-slate-850 p-3 rounded-xl flex flex-col gap-1.5 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-ping" />
                FACE MAPPING CHANNEL
              </span>
              <span className="text-[10px] bg-fuchsia-500/10 text-fuchsia-400 px-1.5 py-0.5 rounded border border-fuchsia-500/20">Active</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 mt-1">
              <div>
                Symmetry: <strong className="text-slate-200">{hr.faceSymmetry}%</strong>
              </div>
              <div>
                Head Tilt: <strong className="text-slate-200">{hr.headTilt}°</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Calibration / Tolerances Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-md">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sans">
            <Target className="w-3.5 h-3.5 text-sky-400" />
            Calibration & Standards
          </h3>
          <button
            onClick={onResetCalibration}
            className="text-[11px] font-medium text-slate-400 hover:text-white cursor-pointer bg-slate-850 hover:bg-slate-800 px-2 py-1 rounded-md border border-slate-750 flex items-center gap-1 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Set Default
          </button>
        </div>

        <p className="text-slate-400 text-xs leading-relaxed mb-4">
          Establish alignment tolerances. Tighter windows challenge stabilizer muscles and require flawless kinetic efficiency.
        </p>

        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-850">
          {(['Elite', 'Pro', 'Recreation'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setTolerance(lvl)}
              className={`py-1.5 px-2 text-xs font-bold rounded-md transition-all cursor-pointer ${tolerance === lvl ? 'bg-sky-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
            >
              {lvl === 'Elite' ? 'Elite (±10°)' : lvl === 'Pro' ? 'Athlete (±18°)' : 'Rec (±26°)'}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Interactive Biomechanical Defects Controller (Only in Sim Mode) */}
      {isSimulated && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-md">
          <div className="flex items-center gap-1.5 mb-3.5">
            <HeartPulse className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
              Form Defects Simulator
            </h3>
            <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>

          <p className="text-slate-400 text-xs mb-4 leading-relaxed">
            Adjust sliders to introduce biomechanical form discrepancies. Observe the color changes in the skeletal links and real-time warnings.
          </p>

          <div className="flex flex-col gap-3.5">
            {/* Defect 1: Elbow Flare */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-300 font-medium font-sans">Elbow Lateral Flare</span>
                <span className="text-sky-400 font-mono font-bold text-[11px]">
                  {formErrors.elbowFlare > 0 ? `${Math.round(formErrors.elbowFlare * 100)}% deviation` : 'Pinned (0%)'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={formErrors.elbowFlare}
                onChange={(e) => handleSliderChange('elbowFlare', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
              />
            </div>

            {/* Defect 2: Depth Limit */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-300 font-medium font-sans">Depth Constraint (Flexion limit)</span>
                <span className="text-sky-400 font-mono font-bold text-[11px]">
                  {formErrors.poorDepth > 0 ? `${Math.round(formErrors.poorDepth * 100)}% short` : 'Bottom reached'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={formErrors.poorDepth}
                onChange={(e) => handleSliderChange('poorDepth', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
              />
            </div>

            {/* Defect 3: Asymmetrical Shift */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-300 font-medium font-sans">Asymmetrical Weight Shift</span>
                <span className="text-sky-400 font-mono font-bold text-[11px]">
                  {formErrors.asymmetry > 0 ? `${Math.round(formErrors.asymmetry * 100)}% L-R drift` : 'Symmetrical (0%)'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={formErrors.asymmetry}
                onChange={(e) => handleSliderChange('asymmetry', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
              />
            </div>

            {/* Defect 4: Trunk lean */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-slate-300 font-medium font-sans">Trunk Lean / Core Sag</span>
                <span className="text-sky-400 font-mono font-bold text-[11px]">
                  {formErrors.forwardLean > 0 ? `${Math.round(formErrors.forwardLean * 100)}% collapse` : 'Straight Core'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.0"
                step="0.05"
                value={formErrors.forwardLean}
                onChange={(e) => handleSliderChange('forwardLean', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Scrolling Biomechanics Live Terminal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col flex-1 shadow-md min-h-[160px] max-h-[220px]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center gap-1.5 font-sans">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          Real-time Biomechanics Feed
        </h3>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-slate-950/80 border border-slate-850/50 rounded-xl p-3 scrollbar-none font-mono text-xs text-slate-300 leading-normal flex flex-col gap-2.5"
        >
          {liveComments.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center py-4 text-slate-500 text-xs italic">
              Awaiting movement stream...
            </div>
          ) : (
            liveComments.map((log, index) => {
              const isWarning = log.includes('⚠️') || log.includes('FLARE') || log.includes('SHALLOW') || log.includes('SAGGING') || log.includes('ASYMMETRY');
              return (
                <div key={index} className="flex gap-2 items-start transition-all animate-fadeIn">
                  {isWarning ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <span className={isWarning ? 'text-amber-400 font-medium' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
