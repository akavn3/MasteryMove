/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExerciseType, Landmark, SessionStats } from './types';
import { calculateAngle, calculateSpineStiffness, detectMovementMismatch } from './utils';
import CameraView from './components/CameraView';
import MetricsPanel from './components/MetricsPanel';
import AISummary from './components/AISummary';
import LiveCoachPanel from './components/LiveCoachPanel';
import { Sparkles, Trophy, BrainCircuit, Activity, RotateCcw, ArrowRight, Library, CheckCircle2, Dumbbell, Shield, HelpCircle, HeartHandshake, Flower2, Flame, Smile, Hand, RefreshCw } from 'lucide-react';

export const WORKOUT_CATALOG: { name: ExerciseType; summary: string; muscles: string[]; keyJoints: string; postureTip: string }[] = [
  {
    name: 'Squats',
    summary: 'Full lower-limb extension with complete hip-hinge depth and spine stabilization tracking.',
    muscles: ['Quadriceps', 'Gluteus Maximus', 'Hamstrings', 'Erectors'],
    keyJoints: 'Hips & Knees (90° target)',
    postureTip: 'Keep trunk lean minimal and send hips backward. Lock heels on ground.'
  },
  {
    name: 'Bicep Curls',
    summary: 'Pure elbow flexion isolates the bicep belly. Prevents elbow flare and compensational shoulder drift.',
    muscles: ['Biceps Brachii', 'Brachialis', 'Brachioradialis'],
    keyJoints: 'Elbow Flexion (40° -> 175°)',
    postureTip: 'Pin upper arm to your ribs. Do not rock hips forward to create momentum.'
  },
  {
    name: 'Overhead Press',
    summary: 'Vertical pushing mechanics tracking shoulder-elbow verticality and bilateral push symmetry.',
    muscles: ['Anterior Deltoids', 'Triceps', 'Upper Trapezius', 'Core'],
    keyJoints: 'Shoulder Elevation & Elbow Locks',
    postureTip: 'Maintain rigid trunk alignment. Complete the lock-out straight overhead.'
  },
  {
    name: 'Pushups',
    summary: 'Closed-kinetic chain pushing. Focuses on full chest depth and strict head-to-toe spine stiffness.',
    muscles: ['Pectoralis Major', 'Triceps Brachii', 'Anterior Deltoids', 'Core stabilizers'],
    keyJoints: 'Elbow Flexion (90° target)',
    postureTip: 'Squeeze glutes and abdominals. Prevent hip sagging or neck dropping.'
  }
];

export const YOGA_CATALOG: { name: ExerciseType; summary: string; muscles: string[]; keyJoints: string; postureTip: string }[] = [
  {
    name: 'Warrior II',
    summary: 'Open hip standing posture. Requires full chest sideways opening and dual horizontal extended arm lines.',
    muscles: ['Quadriceps', 'Gluteus Medius', 'Deltoids', 'Psoas Major'],
    keyJoints: 'Hips and Arms parallel to horizon',
    postureTip: 'Deeply press into your front knee (aim for 90°) while holding arms perfectly parallel to ground.'
  },
  {
    name: 'Tree Pose',
    summary: 'Single-leg balancing. Stabilizes hip flexors and tests central vestibular postural center.',
    muscles: ['Iliopsoas', 'Gemellus', 'Gastrocnemius', 'Transversus Abdominis'],
    keyJoints: 'Anjali Mudra Hands Overhead & Hips open',
    postureTip: 'Place your sole flat against your inner thigh. Never place the foot directly on the knee joint.'
  },
  {
    name: 'Downward Dog',
    summary: 'Inverted transitional stretch. Lengthens spine, activates active scapular elevation, and stretches hamstrings.',
    muscles: ['Gastrocnemius', 'Hamstrings', 'Latissimus Dorsi', 'Deltoids'],
    keyJoints: 'Hip Apex Angle (75° - 90° target)',
    postureTip: 'Push floor away actively with your hands. Keep spine perfectly straight; micro-bend knees if needed.'
  },
  {
    name: 'Cobra Pose',
    summary: 'Gentle spinal backward extension. Elevates sternum and opens thoracic thoracic-cage wall.',
    muscles: ['Erector Spinae', 'Gluteus Maximus', 'Pectoralis Major'],
    keyJoints: 'Lumbar Extension Angle & Elbow lock-base',
    postureTip: 'Keep shoulders drawing back and down away from your ears. Squeeze your lower glutes to protect your low back.'
  }
];

export const HANDS_FACE_CATALOG: { name: ExerciseType; summary: string; muscles: string[]; keyJoints: string; postureTip: string }[] = [
  {
    name: 'Finger Pinch Drill',
    summary: 'Fine-motor hand articulation tracking. Measures index-to-thumb finger tip coordinates convergence.',
    muscles: ['Opponens Pollicis', 'Flexor Digitorum', 'Intrinsic Hand Muscles'],
    keyJoints: 'Thumb & Index (touched proximity)',
    postureTip: 'Open your hand wide facing the camera, then squeeze your thumb and index finger tips together.'
  },
  {
    name: 'Facial Mobility',
    summary: 'Real-time facial landmark tracking. Measures left/right symmetry, eye blinks, and structural balance of facial muscles.',
    muscles: ['Frontalis', 'Orbicularis Oculi', 'Zygomaticus Major'],
    keyJoints: 'Eyes & Mouth (symmetry ratio)',
    postureTip: 'Look directly at the camera. Try raising eyebrows, blinking, or yawning to calibrate muscle activation.'
  }
];

export const EXERCISE_CATALOG = [...WORKOUT_CATALOG, ...YOGA_CATALOG, ...HANDS_FACE_CATALOG];

export default function App() {
  const [viewState, setViewState] = useState<'landing' | 'practice' | 'result'>('landing');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('Squats');
  const [activeCategory, setActiveCategory] = useState<'workouts' | 'yoga' | 'hands_face'>('workouts');
  
  // Custom tolerances
  const [tolerance, setTolerance] = useState<'Elite' | 'Pro' | 'Recreation'>('Pro');

  // Core movement calculations state
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [faceLandmarks, setFaceLandmarks] = useState<Landmark[]>([]);
  const [leftHandLandmarks, setLeftHandLandmarks] = useState<Landmark[]>([]);
  const [rightHandLandmarks, setRightHandLandmarks] = useState<Landmark[]>([]);
  const [isSimulated, setIsSimulated] = useState<boolean>(false); // default to live camera for real-time motion tracking
  const [formErrors, setFormErrors] = useState<{
    elbowFlare: number;
    poorDepth: number;
    asymmetry: number;
    forwardLean: number;
    exerciseMismatch?: string;
  }>({
    elbowFlare: 0,
    poorDepth: 0,
    asymmetry: 0,
    forwardLean: 0,
    exerciseMismatch: ''
  });

  // Rep counter state-machine tracking
  const [repCount, setRepCount] = useState(0);
  const [trackingState, setTrackingState] = useState<number>(0); // 0 = start/extended, 1 = deep/flexed
  const [activeHoldTime, setActiveHoldTime] = useState<number>(0);
  const [liveComments, setLiveComments] = useState<string[]>([]);
  
  // Historical session statistics
  const [accuracySamples, setAccuracySamples] = useState<number[]>([]);
  const [symmetrySamples, setSymmetrySamples] = useState<number[]>([]);
  const [postureSamples, setPostureSamples] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  // Synchronous references for quick-access voice connecting inside header
  const [voiceStatus, setVoiceStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const triggerVoiceConnectRef = useRef<(() => void) | null>(null);

  const timerRef = useRef<number | null>(null);
  const lastSpokenTimeRef = useRef<number>(0);

  // Synchronous tracking references to solve render-batching state lags, duplicated reps, or flood alerting
  const trackingStateRef = useRef<number>(0); // 0 = start/extension, 1 = deep concentric zone
  const peakMetricRef = useRef<number>(180);  // stores extreme angle achieved during a repetition peak (flexion or lock)
  const lastAlertTimesRef = useRef<Record<string, number>>({}); // rate-limiting comments stream by key signature alert
  const poseHoldStartTimeRef = useRef<number | null>(null); // accurate milliseconds timestamp when a yoga posture is perfectly completed
  const lastRepCountRef = useRef<number>(0); // tracks running rep integers to support live string updates dynamically

  // Clear any residual form errors when switching to simulation mode for a clean perfect-drill display
  useEffect(() => {
    if (isSimulated) {
      setFormErrors({
        elbowFlare: 0,
        poorDepth: 0,
        asymmetry: 0,
        forwardLean: 0,
        exerciseMismatch: ''
      });
      setLiveComments([]); // clear the warning terminal so the motion looks clean
    }
  }, [isSimulated]);

  // Dynamic feedback thresholds based on tolerance standard
  const getToleranceWindow = () => {
    if (tolerance === 'Elite') return 12;
    if (tolerance === 'Pro') return 20;
    return 28;
  };

  // 1. Reset practice metrics
  const startPractice = () => {
    setRepCount(0);
    setTrackingState(0);
    
    // Reset synchronous state refs
    trackingStateRef.current = 0;
    peakMetricRef.current = 180;
    lastAlertTimesRef.current = {};
    poseHoldStartTimeRef.current = null;
    lastRepCountRef.current = 0;

    setAccuracySamples([]);
    setSymmetrySamples([]);
    setPostureSamples([]);
    setDuration(0);
    setLiveComments(['💻 Precision telemetry stream opened. Choose Live Camera or Virtual Simulator.']);
    
    // Set up standard calibration base
    resetCalibration();

    setViewState('practice');

    // Timer start
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const endPractice = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Compute final session averages
    const finalPrecision = accuracySamples.length > 0 
      ? Math.round(accuracySamples.reduce((a, b) => a + b, 0) / accuracySamples.length)
      : 85;
    
    const finalSymmetry = symmetrySamples.length > 0
      ? Math.round(symmetrySamples.reduce((a, b) => a + b, 0) / symmetrySamples.length)
      : 90;

    const finalPosture = postureSamples.length > 0
      ? Math.round(postureSamples.reduce((a, b) => a + b, 0) / postureSamples.length)
      : 88;

    // Filter warnings from the stream for AI appraisal
    const uniqueWarnings = Array.from(new Set(liveComments.filter(str => str.includes('⚠️'))));

    setSessionStats({
      exercise: selectedExercise,
      repCount: repCount,
      precisionScore: Math.min(100, Math.max(0, finalPrecision)),
      symmetryScore: Math.min(100, Math.max(0, finalSymmetry)),
      postureScore: Math.min(100, Math.max(0, finalPosture)),
      duration: duration || 24,
      feedbackHistory: uniqueWarnings,
      angleStats: {
        leftSidePeakFlexion: selectedExercise === 'Squats' || selectedExercise === 'Pushups' ? 92 : 45,
        rightSidePeakFlexion: selectedExercise === 'Squats' || selectedExercise === 'Pushups' ? 95 : 42,
        posturalSpineRigidity: finalPosture
      }
    });

    setViewState('result');
  };

  const resetCalibration = () => {
    setFormErrors({
      elbowFlare: 0.0,
      poorDepth: 0.0,
      asymmetry: 0.0,
      forwardLean: 0.0
    });
    setLiveComments((prev) => [...prev, '⚙️ Bio-mechanical calibration reset to standard default baseline posture.']);
  };

  // 2. Compute Biomechanical Rules on every pose frame Results update
  const makePoseAnalytics = (pts: Landmark[]) => {
    if (pts.length < 29) return;

    const tolLimit = getToleranceWindow();
    let currentPrecision = 100;
    let currentSymmetry = 100;
    let currentPosture = 100;

    const now = Date.now();

    // Exercise Mismatch & Biomechanical Safeguard Detection
    if (!isSimulated) {
      const mismatch = detectMovementMismatch(pts, selectedExercise);
      if (mismatch.mismatchDetected) {
        pushThrottledAlert(mismatch.warningText, 4500);
        
        // Lock errors to peak to drop precision score to represent failed compliance
        setFormErrors({
          elbowFlare: 1.0,
          poorDepth: 1.0,
          asymmetry: 1.0,
          forwardLean: 1.0,
          exerciseMismatch: mismatch.perceivedExercise
        });
        
        setAccuracySamples((prev) => [...prev, 10].slice(-30));
        setSymmetrySamples((prev) => [...prev, 10].slice(-30));
        setPostureSamples((prev) => [...prev, 10].slice(-30));
        return; // Exit early to block reps logging or positive verbal praise!
      } else if (formErrors.exerciseMismatch) {
        // Clear active mismatch if they returned to correct movement pattern
        setFormErrors(prev => ({
          ...prev,
          exerciseMismatch: ''
        }));
      }
    }

    let calculatedElbowFlare = 0;
    let calculatedPoorDepth = 0;
    let calculatedAsymmetry = 0;
    let calculatedForwardLean = 0;

    // SQUATS RULESETS
    if (selectedExercise === 'Squats') {
      const leftHip = pts[23], leftKnee = pts[25], leftAnkle = pts[27];
      const rightHip = pts[24], rightKnee = pts[26], rightAnkle = pts[28];
      const shoulderLeft = pts[11], ankleLeft = pts[27];

      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

      // 1. Spacing and symmetry balance check
      const leftKneeDiff = Math.abs(leftKneeAngle - rightKneeAngle);
      currentSymmetry = Math.max(0, Math.round(100 - leftKneeDiff * 2.5));

      // 2. Trunk lean/rigidity scoring
      currentPosture = calculateSpineStiffness(shoulderLeft, leftHip, ankleLeft);

      // 3. Squat Rep State-Machine
      const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

      if (!isSimulated) {
        calculatedPoorDepth = avgKneeAngle < 165 
          ? Math.max(0, Math.min(1.0, (avgKneeAngle - 100) / 60))
          : 0;
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 40));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedElbowFlare = 0;
      } else {
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedElbowFlare = formErrors.elbowFlare;
      }
      
      // State tracking: 0 = standing, 1 = squatting peak descent
      if (trackingStateRef.current === 0) {
        if (avgKneeAngle < 125) {
          trackingStateRef.current = 1;
          setTrackingState(1);
          peakMetricRef.current = avgKneeAngle; // Init flexion peak
        }
      } else if (trackingStateRef.current === 1) {
        // Track the lowest angle achieved (deepest part of the squat)
        peakMetricRef.current = Math.min(peakMetricRef.current, avgKneeAngle);

        // Standard extension stand-up completion threshold
        if (avgKneeAngle > 150) {
          trackingStateRef.current = 0;
          setTrackingState(0);
          
          // Evaluate form based on peak depth achieved at bottom of rep
          const finalPeak = peakMetricRef.current;
          const targetDepth = 105;
          const isShallow = finalPeak > targetDepth;

          if (isShallow) {
            pushAlert(`⚠️ SHALLOW SQUAT: Knee flexion peaked above 105° (reached ${Math.round(finalPeak)}°). Drop your hips lower next time.`);
          } else {
            pushAlert(`🟢 DEPTH OPTIMAL: Knee kinematics hit target parallel window (reached ${Math.round(finalPeak)}°). Excellent depth.`);
          }

          if (currentPosture < 80) {
            pushThrottledAlert('⚠️ POSTURAL OVERLEAN: Your back is folding forward. Keep your core braced and chest tall.', 4000);
          }
          if (currentSymmetry < 85) {
            pushThrottledAlert('⚠️ ASYMMETRICAL LOAD: Your weight is shifting horizontally. Push through both feet equally.', 4000);
          }

          // Safe rep increment
          const nextReps = lastRepCountRef.current + 1;
          lastRepCountRef.current = nextReps;
          setRepCount(nextReps);
          pushAlert(`🔥 Rep ${nextReps} locked in. Excellent extension template.`);
        }
      }

      // Compute instant precision penalty
      const squatErrorPenalty = (calculatedPoorDepth * 28) + (calculatedAsymmetry * 24) + (calculatedForwardLean * 20);
      currentPrecision = Math.max(10, Math.round(92 - squatErrorPenalty));

    // BICEP CURL RULESETS
    } else if (selectedExercise === 'Bicep Curls') {
      const shoulderLeft = pts[11], elbowLeft = pts[13], wristLeft = pts[15];
      const shoulderRight = pts[12], elbowRight = pts[14], wristRight = pts[16];
      const hipLeft = pts[23], ankleLeft = pts[27];

      const leftElbowAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
      const rightElbowAngle = calculateAngle(shoulderRight, elbowRight, wristRight);

      // Symmetry of curl tempo
      const elbowDiff = Math.abs(leftElbowAngle - rightElbowAngle);
      currentSymmetry = Math.max(0, Math.round(100 - elbowDiff * 1.8));

      // Posture stiffness (swaying torso to cheat)
      currentPosture = calculateSpineStiffness(shoulderLeft, pts[23], pts[27]);

      const avgElbow = (leftElbowAngle + rightElbowAngle) / 2;

      if (!isSimulated) {
        const shoulderWidth = Math.max(0.01, Math.sqrt(Math.pow(pts[11].x - pts[12].x, 2) + Math.pow(pts[11].y - pts[12].y, 2)));
        const leftFlareRatio = Math.abs(pts[13].x - pts[11].x) / shoulderWidth;
        const rightFlareRatio = Math.abs(pts[14].x - pts[12].x) / shoulderWidth;
        const maxFlareRatio = Math.max(leftFlareRatio, rightFlareRatio);
        calculatedElbowFlare = Math.max(0, Math.min(1.0, (maxFlareRatio - 0.28) / 0.45));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 40));
        calculatedPoorDepth = 0;
      } else {
        calculatedElbowFlare = formErrors.elbowFlare;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedPoorDepth = formErrors.poorDepth;
      }

      // State machine for curl reps: 0 = extended bottom (~160 deg), 1 = fully contracted top (~50 deg)
      if (trackingStateRef.current === 0) {
        if (avgElbow < 75) {
          trackingStateRef.current = 1;
          setTrackingState(1);
          peakMetricRef.current = avgElbow; // track deepest contraction (minimum elbow angle)
        }
      } else if (trackingStateRef.current === 1) {
        peakMetricRef.current = Math.min(peakMetricRef.current, avgElbow);

        if (avgElbow > 140) {
          trackingStateRef.current = 0;
          setTrackingState(0);
          
          if (calculatedElbowFlare > 0.3) {
            pushAlert('⚠️ ELBOW FLARE: Your elbows are drifting wide. Pin them tight to your ribs to isolate the bicep.');
          } else {
            pushAlert('🟢 PEAK CONTRACTION: Peak motor-unit recruitment achieved at top of curl.');
          }

          const nextReps = lastRepCountRef.current + 1;
          lastRepCountRef.current = nextReps;
          setRepCount(nextReps);
          pushAlert(`🔥 Rep ${nextReps} finalized. Clean eccentric extension.`);
        }
      }

      const curlErrorPenalty = (calculatedElbowFlare * 35) + (calculatedAsymmetry * 30);
      currentPrecision = Math.max(10, Math.round(96 - curlErrorPenalty));

    // OVERHEAD PRESS RULESETS
    } else if (selectedExercise === 'Overhead Press') {
      const shoulderLeft = pts[11], elbowLeft = pts[13], wristLeft = pts[15];
      const shoulderRight = pts[12], elbowRight = pts[14], wristRight = pts[16];

      const leftElbowAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
      const rightElbowAngle = calculateAngle(shoulderRight, elbowRight, wristRight);

      currentSymmetry = Math.max(0, Math.round(100 - Math.abs(leftElbowAngle - rightElbowAngle) * 2.0));
      currentPosture = calculateSpineStiffness(shoulderLeft, pts[23], pts[27]);

      const avgElbow = (leftElbowAngle + rightElbowAngle) / 2;

      if (!isSimulated) {
        const shoulderWidth = Math.max(0.01, Math.sqrt(Math.pow(pts[11].x - pts[12].x, 2) + Math.pow(pts[11].y - pts[12].y, 2)));
        const leftFlareRatio = Math.abs(pts[13].x - pts[11].x) / shoulderWidth;
        const rightFlareRatio = Math.abs(pts[14].x - pts[12].x) / shoulderWidth;
        const maxFlareRatio = Math.max(leftFlareRatio, rightFlareRatio);
        calculatedElbowFlare = Math.max(0, Math.min(1.0, (maxFlareRatio - 0.28) / 0.45));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 40));
        calculatedPoorDepth = 0;
      } else {
        calculatedElbowFlare = formErrors.elbowFlare;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedPoorDepth = formErrors.poorDepth;
      }

      // State machine: 0 = starting neck shelf, 1 = completed overhead extension
      if (trackingStateRef.current === 0) {
        if (avgElbow > 145) {
          trackingStateRef.current = 1;
          setTrackingState(1);
          peakMetricRef.current = avgElbow; // track peak extension
        }
      } else if (trackingStateRef.current === 1) {
        peakMetricRef.current = Math.max(peakMetricRef.current, avgElbow);

        if (avgElbow < 110) {
          trackingStateRef.current = 0;
          setTrackingState(0);
          
          if (currentSymmetry < 80) {
            pushAlert('⚠️ BI-LATERAL BALANCING WARNING: One side is locking slower. Balance your vertical thrust.');
          } else {
            pushAlert('🟢 PERFECT LOCKOUT: Full scapular elevation achieved.');
          }

          const nextReps = lastRepCountRef.current + 1;
          lastRepCountRef.current = nextReps;
          setRepCount(nextReps);
          pushAlert(`🔥 Rep ${nextReps}. Shoulder press baseline locked.`);
        }
      }

      const pressPenalty = (calculatedElbowFlare * 25) + (calculatedAsymmetry * 38);
      currentPrecision = Math.max(10, Math.round(94 - pressPenalty));

    // PUSHUP RULESETS
    } else if (selectedExercise === 'Pushups') {
      const leftElbowAngle = calculateAngle(pts[11], pts[13], pts[15]);
      const rightElbowAngle = calculateAngle(pts[12], pts[14], pts[16]);
      currentPosture = calculateSpineStiffness(pts[11], pts[23], pts[27]);

      if (!isSimulated) {
        const elbowDiff = Math.abs(leftElbowAngle - rightElbowAngle);
        currentSymmetry = Math.max(10, Math.round(100 - elbowDiff * 1.8));
        const shoulderWidth = Math.max(0.01, Math.sqrt(Math.pow(pts[11].x - pts[12].x, 2) + Math.pow(pts[11].y - pts[12].y, 2)));
        const leftFlareRatio = Math.abs(pts[13].x - pts[11].x) / shoulderWidth;
        const rightFlareRatio = Math.abs(pts[14].x - pts[12].x) / shoulderWidth;
        const maxFlareRatio = Math.max(leftFlareRatio, rightFlareRatio);
        calculatedElbowFlare = Math.max(0, Math.min(1.0, (maxFlareRatio - 0.28) / 0.45));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 45));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedPoorDepth = 0;
      } else {
        currentSymmetry = Math.max(10, Math.round(100 - formErrors.asymmetry * 34));
        calculatedElbowFlare = formErrors.elbowFlare;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedPoorDepth = formErrors.poorDepth;
      }

      // State machine: 0 = top of plank, 1 = deep bottom chest floor
      if (trackingStateRef.current === 0) {
        if (leftElbowAngle < 120) {
          trackingStateRef.current = 1;
          setTrackingState(1);
          peakMetricRef.current = leftElbowAngle; // track minimum depth angle
        }
      } else if (trackingStateRef.current === 1) {
        peakMetricRef.current = Math.min(peakMetricRef.current, leftElbowAngle);

        if (leftElbowAngle > 140) {
          trackingStateRef.current = 0;
          setTrackingState(0);
          
          if (calculatedForwardLean > 0.4) {
            pushAlert('⚠️ SAGGING HIPS: Your pelvis is dipping. Tighten your lower glutes to lock your torso in alignment.');
          } else {
            pushAlert('🟢 STRICT PUSHUP DEPTH: Full anterior load activated.');
          }

          const nextReps = lastRepCountRef.current + 1;
          lastRepCountRef.current = nextReps;
          setRepCount(nextReps);
          pushAlert(`🔥 Rep ${nextReps}. Structural integrity 100% controlled.`);
        }
      }

      const pushupPenalty = (calculatedForwardLean * 32) + (calculatedElbowFlare * 28);
      currentPrecision = Math.max(10, Math.round(91 - pushupPenalty));

    // WARRIOR II RULESETS
    } else if (selectedExercise === 'Warrior II') {
      const shoulderLeft = pts[11], elbowLeft = pts[13], wristLeft = pts[15];
      const shoulderRight = pts[12], elbowRight = pts[14], wristRight = pts[16];
      const leftHip = pts[23], leftKnee = pts[25], leftAnkle = pts[27];
      const rightHip = pts[24], rightKnee = pts[26], rightAnkle = pts[28];

      const leftElbowAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
      const rightElbowAngle = calculateAngle(shoulderRight, elbowRight, wristRight);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);

      const averageElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;
      currentSymmetry = Math.max(0, Math.round(100 - Math.abs(leftElbowAngle - rightElbowAngle) * 1.5));
      currentPosture = calculateSpineStiffness(shoulderLeft, leftHip, leftAnkle);

      if (!isSimulated) {
        calculatedPoorDepth = Math.max(0, Math.min(1.0, (rightKneeAngle - 110) / 45));
        const leftSag = Math.abs(pts[13].y - pts[11].y);
        const rightSag = Math.abs(pts[14].y - pts[12].y);
        const maxSag = Math.max(leftSag, rightSag);
        calculatedElbowFlare = Math.max(0, Math.min(1.0, (maxSag - 0.05) / 0.15));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 40));
      } else {
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedElbowFlare = formErrors.elbowFlare;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedForwardLean = formErrors.forwardLean;
      }

      // Requirements for successful Warrior II alignment hold: Knee bent sufficiently (<125) & arms extended (>160)
      const hasCorrectPosture = rightKneeAngle < 125 && averageElbowAngle > 160;

      if (hasCorrectPosture) {
        if (poseHoldStartTimeRef.current === null) {
          poseHoldStartTimeRef.current = Date.now();
          setActiveHoldTime(0);
          pushThrottledAlert('🟢 WARRIOR II LOCK: Perfect alignment established. Hold steady!', 6000);
        } else {
          const heldSec = (Date.now() - poseHoldStartTimeRef.current) / 1000;
          setActiveHoldTime(heldSec);
          if (heldSec >= 2.0) {
            // Success! Award 1 hold count
            const nextReps = lastRepCountRef.current + 1;
            lastRepCountRef.current = nextReps;
            setRepCount(nextReps);
            poseHoldStartTimeRef.current = null; // Reset hold
            setActiveHoldTime(0);
            pushAlert(`🔥 Hold ${nextReps} registered! Excellent alignment stability.`);
          }
        }
      } else {
        // Alignment is broken or not yet reached
        poseHoldStartTimeRef.current = null;
        setActiveHoldTime(0);
        
        // Throttled coaching suggestions (once every 4 seconds) to prevent alert flooding
        if (rightKneeAngle >= 125) {
          pushThrottledAlert('⚠️ SHALLOW LUNGE: Bend your front leg deeper towards 90° to engage your quad and hip.', 4000);
        }
        if (averageElbowAngle <= 160) {
          pushThrottledAlert('⚠️ BENT ARMS: Extend both arms energetically straight out to the horizon.', 4000);
        }
      }

      const warriorPenalty = (calculatedPoorDepth * 25) + (calculatedElbowFlare * 30);
      currentPrecision = Math.max(10, Math.round(95 - warriorPenalty));

    // TREE POSE RULESETS
    } else if (selectedExercise === 'Tree Pose') {
      const leftHip = pts[23], leftKnee = pts[25], leftAnkle = pts[27];
      const shoulderLeft = pts[11], elbowLeft = pts[13], wristLeft = pts[15];
      const shoulderRight = pts[12], elbowRight = pts[14], wristRight = pts[16];

      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const leftElbowAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);

      if (!isSimulated) {
        currentSymmetry = Math.max(10, Math.round(100 - Math.abs(leftElbowAngle - calculateAngle(shoulderRight, elbowRight, wristRight)) * 1.5));
        currentPosture = calculateSpineStiffness(shoulderLeft, pts[23], pts[27]);
        calculatedPoorDepth = Math.max(0, Math.min(1.0, (leftKneeAngle - 105) / 50));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 40));
        calculatedElbowFlare = 0;
      } else {
        currentSymmetry = Math.max(10, Math.round(100 - (formErrors.asymmetry * 25)));
        currentPosture = calculateSpineStiffness(shoulderLeft, pts[23], pts[27]);
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedElbowFlare = formErrors.elbowFlare;
      }

      // Requirements for balanced hold: Knee flared (<105) & standing tall (posture >= 80)
      const hasCorrectPosture = leftKneeAngle < 105 && currentPosture >= 80;

      if (hasCorrectPosture) {
        if (poseHoldStartTimeRef.current === null) {
          poseHoldStartTimeRef.current = Date.now();
          setActiveHoldTime(0);
          pushThrottledAlert('🟢 TREE POSE BALANCE ACQUIRED: Postural core and pelvis locked horizontally.', 6000);
        } else {
          const heldSec = (Date.now() - poseHoldStartTimeRef.current) / 1000;
          setActiveHoldTime(heldSec);
          if (heldSec >= 2.0) {
            const nextReps = lastRepCountRef.current + 1;
            lastRepCountRef.current = nextReps;
            setRepCount(nextReps);
            poseHoldStartTimeRef.current = null;
            setActiveHoldTime(0);
            pushAlert(`🔥 Zen hold ${nextReps} locked. Stability and posture verified.`);
          }
        }
      } else {
        poseHoldStartTimeRef.current = null;
        setActiveHoldTime(0);
        if (leftKneeAngle >= 105) {
          pushThrottledAlert('⚠️ OPEN BENT KNEE: Open your bent left knee outwards and secure your foot stance on your inner thigh.', 4000);
        }
        if (currentPosture < 80) {
          pushThrottledAlert('⚠️ TRUNK SAG / LEAN: Stand tall through your crown. Brace your hips.', 4000);
        }
      }

      const treePenalty = (calculatedAsymmetry * 35) + (calculatedPoorDepth * 20);
      currentPrecision = Math.max(10, Math.round(94 - treePenalty));

    // DOWNWARD DOG RULESETS
    } else if (selectedExercise === 'Downward Dog') {
      const hipLeft = pts[23], shoulderLeft = pts[11], wristLeft = pts[15];
      const kneeLeft = pts[25], ankleLeft = pts[27];
      const kneeRight = pts[26], ankleRight = pts[28];

      const shoulderLeftAngle = calculateAngle(hipLeft, shoulderLeft, wristLeft);
      const kneeLeftAngle = calculateAngle(hipLeft, kneeLeft, ankleLeft);
      const kneeRightAngle = calculateAngle(pts[24], kneeRight, ankleRight);

      currentPosture = calculateSpineStiffness(shoulderLeft, hipLeft, ankleLeft);

      if (!isSimulated) {
        const kneeDiff = Math.abs(kneeLeftAngle - kneeRightAngle);
        currentSymmetry = Math.max(10, Math.round(100 - kneeDiff * 2.0));
        calculatedPoorDepth = Math.max(0, Math.min(1.0, (160 - kneeLeftAngle) / 40));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (155 - shoulderLeftAngle) / 40));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedElbowFlare = 0;
      } else {
        currentSymmetry = Math.max(10, Math.round(100 - (formErrors.asymmetry * 28)));
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedElbowFlare = formErrors.elbowFlare;
      }

      // Requirements: open shoulders (>155) & knees extended (>150)
      const hasCorrectPosture = shoulderLeftAngle > 155 && kneeLeftAngle > 150;

      if (hasCorrectPosture) {
        if (poseHoldStartTimeRef.current === null) {
          poseHoldStartTimeRef.current = Date.now();
          setActiveHoldTime(0);
          pushThrottledAlert('🟢 DOWNWARD DOG COMPLETED: Hips pushed high, heels driven down, and thoracic arch flat.', 6000);
        } else {
          const heldSec = (Date.now() - poseHoldStartTimeRef.current) / 1000;
          setActiveHoldTime(heldSec);
          if (heldSec >= 2.0) {
            const nextReps = lastRepCountRef.current + 1;
            lastRepCountRef.current = nextReps;
            setRepCount(nextReps);
            poseHoldStartTimeRef.current = null;
            setActiveHoldTime(0);
            pushAlert(`🔥 Perfect inverted apex lock ${nextReps} registered!`);
          }
        }
      } else {
        poseHoldStartTimeRef.current = null;
        setActiveHoldTime(0);
        if (kneeLeftAngle <= 150) {
          pushThrottledAlert('⚠️ BENT KNEES: If tight, keep knees slightly bent but prioritize pushing hips up.', 4000);
        }
        if (shoulderLeftAngle <= 155) {
          pushThrottledAlert('⚠️ CLOSED SHOULDERS: Press your chest back towards your thighs to open your armpits.', 4000);
        }
      }

      const dogPenalty = (calculatedPoorDepth * 30) + (calculatedForwardLean * 24);
      currentPrecision = Math.max(10, Math.round(92 - dogPenalty));

    // COBRA POSE RULESETS
    } else if (selectedExercise === 'Cobra Pose') {
      const shoulderLeft = pts[11], hipLeft = pts[23], ankleLeft = pts[27];
      const elbowLeft = pts[13], wristLeft = pts[15];
      const elbowRight = pts[14], wristRight = pts[16];

      const elbowLeftAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
      const elbowRightAngle = calculateAngle(pts[12], elbowRight, wristRight);
      
      const hipsStayingLow = hipLeft.y > 0.73;
      currentPosture = Math.round(100 - Math.abs(shoulderLeft.y - hipLeft.y) * 100);

      if (!isSimulated) {
        const armDiff = Math.abs(elbowLeftAngle - elbowRightAngle);
        currentSymmetry = Math.max(10, Math.round(100 - armDiff * 1.8));
        calculatedPoorDepth = Math.max(0, Math.min(1.0, (0.73 - hipLeft.y) / 0.15));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (shoulderLeft.y - 0.55) / 0.15));
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedElbowFlare = 0;
      } else {
        currentSymmetry = Math.max(0, Math.round(100 - formErrors.asymmetry * 30));
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedElbowFlare = formErrors.elbowFlare;
      }

      // Requirements: Lifted shoulders (<0.65) and grounded hips
      const hasCorrectPosture = shoulderLeft.y < 0.65 && hipsStayingLow;

      if (hasCorrectPosture) {
        if (poseHoldStartTimeRef.current === null) {
          poseHoldStartTimeRef.current = Date.now();
          setActiveHoldTime(0);
          pushThrottledAlert('🟢 COBRA POSTURE ACTIVE: Scapulas drawn back, chest wall opened vertically, hips grounded.', 6000);
        } else {
          const heldSec = (Date.now() - poseHoldStartTimeRef.current) / 1000;
          setActiveHoldTime(heldSec);
          if (heldSec >= 2.0) {
            const nextReps = lastRepCountRef.current + 1;
            lastRepCountRef.current = nextReps;
            setRepCount(nextReps);
            poseHoldStartTimeRef.current = null;
            setActiveHoldTime(0);
            pushAlert(`🔥 Heart-opening pose hold ${nextReps} completed!`);
          }
        }
      } else {
        poseHoldStartTimeRef.current = null;
        setActiveHoldTime(0);
        if (!hipsStayingLow) {
          pushThrottledAlert('⚠️ HIPS OFF GROUND: Anchor your pelvic bones to the mat. Lift using spine extensors.', 4000);
        }
        if (shoulderLeft.y >= 0.65) {
          pushThrottledAlert('⚠️ COLLAPSED SPINAL ARCH: Squeeze shoulder blades together and lift your heart.', 4000);
        }
      }

      const cobraPenalty = (calculatedForwardLean * 38) + (calculatedElbowFlare * 22);
      currentPrecision = Math.max(10, Math.round(93 - cobraPenalty));

    } else if (selectedExercise === 'Finger Pinch Drill') {
      let leftDist = 1.0;
      let rightDist = 1.0;

      // Use true high-precision hand landmarks if they are detected in the frame!
      if (leftHandLandmarks && leftHandLandmarks.length >= 21) {
        const thumbTip = leftHandLandmarks[4];
        const indexTip = leftHandLandmarks[8];
        if (thumbTip && indexTip) {
          leftDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
        }
      } else {
        const leftThumb = pts[21], leftIndex = pts[19];
        if (leftThumb && leftIndex && (!leftThumb.visibility || leftThumb.visibility > 0.01) && (!leftIndex.visibility || leftIndex.visibility > 0.01)) {
          leftDist = Math.sqrt(Math.pow(leftThumb.x - leftIndex.x, 2) + Math.pow(leftThumb.y - leftIndex.y, 2));
        }
      }

      if (rightHandLandmarks && rightHandLandmarks.length >= 21) {
        const thumbTip = rightHandLandmarks[4];
        const indexTip = rightHandLandmarks[8];
        if (thumbTip && indexTip) {
          rightDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
        }
      } else {
        const rightThumb = pts[22], rightIndex = pts[20];
        if (rightThumb && rightIndex && (!rightThumb.visibility || rightThumb.visibility > 0.01) && (!rightIndex.visibility || rightIndex.visibility > 0.01)) {
          rightDist = Math.sqrt(Math.pow(rightThumb.x - rightIndex.x, 2) + Math.pow(rightThumb.y - rightIndex.y, 2));
        }
      }

      const avgDist = (leftDist + rightDist) / 2;

      // Symmetry checking: left proximity vs right proximity
      const distDiff = Math.abs(leftDist - rightDist);
      currentSymmetry = Math.max(10, Math.round(100 - distDiff * 350));

      // Posture: neck/torso stiffness to keep focus while doing hand gestures
      currentPosture = calculateSpineStiffness(pts[11], pts[23], pts[27]);

      if (!isSimulated) {
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedPoorDepth = Math.max(0, Math.min(1.0, (avgDist - 0.035) / 0.08));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (85 - currentPosture) / 40));
        calculatedElbowFlare = 0;
      } else {
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedElbowFlare = formErrors.elbowFlare;
      }

      // State machine: 0 = fingers wide, 1 = pinched
      if (trackingStateRef.current === 0) {
        if (avgDist < 0.045) {
          trackingStateRef.current = 1;
          setTrackingState(1);
          peakMetricRef.current = avgDist; // track minimum distance
        }
      } else if (trackingStateRef.current === 1) {
        peakMetricRef.current = Math.min(peakMetricRef.current, avgDist);

        if (avgDist > 0.065) {
          trackingStateRef.current = 0;
          setTrackingState(0);
          
          if (leftDist > 0.045 && calculatedAsymmetry > 0.3) {
            pushAlert('⚠️ PINCH ASYMMETRY: Left hand finger pinch is incomplete. Squeeze tips together.');
          } else {
            pushAlert('🟢 PINCH LOCK: Index finger and thumb tips achieved positive contact.');
          }

          const nextReps = lastRepCountRef.current + 1;
          lastRepCountRef.current = nextReps;
          setRepCount(nextReps);
          pushAlert(`🔥 Articulation Rep ${nextReps} locked-in. Excellent hand range.`);
        }
      }

      const pinchPenalty = (calculatedAsymmetry * 25) + (calculatedPoorDepth * 30);
      currentPrecision = Math.max(10, Math.round(96 - pinchPenalty));

    } else if (selectedExercise === 'Facial Mobility') {
      const nose = pts[0];
      const leftEye = pts[2], rightEye = pts[5];
      const leftMouth = pts[9], rightMouth = pts[10];

      // Measure symmetry ratios
      let leftEyeDist = 0;
      let rightEyeDist = 0;
      let eyeYDiff = 0;
      if (nose && leftEye && rightEye && (!nose.visibility || nose.visibility > 0.01) && (!leftEye.visibility || leftEye.visibility > 0.01) && (!rightEye.visibility || rightEye.visibility > 0.01)) {
        leftEyeDist = Math.sqrt(Math.pow(leftEye.x - nose.x, 2) + Math.pow(leftEye.y - nose.y, 2));
        rightEyeDist = Math.sqrt(Math.pow(rightEye.x - nose.x, 2) + Math.pow(rightEye.y - nose.y, 2));
        eyeYDiff = Math.abs((leftEye.y - nose.y) - (rightEye.y - nose.y));
      }

      // Symmetrical facial position test
      currentSymmetry = Math.max(10, Math.round(100 - eyeYDiff * 800));

      // Posture check: neck alignment tilt deflection
      const headTiltDeviation = Math.abs((pts[7]?.y || 0.3) - (pts[8]?.y || 0.3));
      currentPosture = Math.max(10, Math.round(100 - headTiltDeviation * 350));

      if (!isSimulated) {
        calculatedAsymmetry = Math.max(0, Math.min(1.0, (90 - currentSymmetry) / 45));
        calculatedForwardLean = Math.max(0, Math.min(1.0, (90 - currentPosture) / 45));
        calculatedPoorDepth = 0;
        calculatedElbowFlare = 0;
      } else {
        calculatedAsymmetry = formErrors.asymmetry;
        calculatedForwardLean = formErrors.forwardLean;
        calculatedPoorDepth = formErrors.poorDepth;
        calculatedElbowFlare = formErrors.elbowFlare;
      }

      // Expression cycles: measuring distance from eye to mouth corners
      let leftMouthEyeDist = 0.5;
      if (leftEye && leftMouth) {
        leftMouthEyeDist = Math.abs(leftEye.y - leftMouth.y);
      }

      if (trackingStateRef.current === 0) {
        if (leftMouthEyeDist > 0.043) {
          trackingStateRef.current = 1;
          setTrackingState(1);
          peakMetricRef.current = leftMouthEyeDist; // track max lift
        }
      } else if (trackingStateRef.current === 1) {
        peakMetricRef.current = Math.max(peakMetricRef.current, leftMouthEyeDist);

        if (leftMouthEyeDist < 0.041) {
          trackingStateRef.current = 0;
          setTrackingState(0);
          
          if (eyeYDiff > 0.006 && calculatedAsymmetry > 0.35) {
            pushAlert('⚠️ FACIAL ASYMMETRY: Uneven horizontal activation. Coordinate bilateral musculature.');
          } else {
            pushAlert('🟢 BILATERAL SYMMETRY: Good symmetrical face musculature raise!');
          }

          const nextReps = lastRepCountRef.current + 1;
          lastRepCountRef.current = nextReps;
          setRepCount(nextReps);
          pushAlert(`🔥 Expression Cycle ${nextReps} finalized. Motor nerves responsive.`);
        }
      }

      const facialPenalty = (calculatedAsymmetry * 35) + (calculatedForwardLean * 24);
      currentPrecision = Math.max(10, Math.round(95 - facialPenalty));
    }

    // Secure real-time posture correction update to formErrors in parent state
    if (!isSimulated) {
      const nextElbowFlare = Math.round(calculatedElbowFlare * 100) / 100;
      const nextPoorDepth = Math.round(calculatedPoorDepth * 100) / 100;
      const nextAsymmetry = Math.round(calculatedAsymmetry * 100) / 100;
      const nextForwardLean = Math.round(calculatedForwardLean * 100) / 100;

      const diff = Math.abs(formErrors.elbowFlare - nextElbowFlare) +
                   Math.abs(formErrors.poorDepth - nextPoorDepth) +
                   Math.abs(formErrors.asymmetry - nextAsymmetry) +
                   Math.abs(formErrors.forwardLean - nextForwardLean);

      if (diff > 0.02) {
        setFormErrors({
          elbowFlare: nextElbowFlare,
          poorDepth: nextPoorDepth,
          asymmetry: nextAsymmetry,
          forwardLean: nextForwardLean
        });
      }
    }

    // Capture running telemetry samples
    setAccuracySamples((prev) => [...prev, currentPrecision].slice(-30));
    setSymmetrySamples((prev) => [...prev, currentSymmetry].slice(-30));
    setPostureSamples((prev) => [...prev, currentPosture].slice(-30));
  };

  // Real-time audio coaching speak routine
  const speakCoachingInstruction = async (text: string) => {
    // DISABLE_BIOMECHANICS_FEED_AUDIO: User requested to turn off speech cues.
    return;
  };

  const pushAlert = (msg: string) => {
    setLiveComments((prev) => {
      // Don't repeat the warning if it was literally just sent
      if (prev[prev.length - 1] === msg) return prev;
      return [...prev, msg].slice(-24);
    });

    // Speak corrections (starts with ⚠️) or critical performance peaks (starts with 🟢)
    const isMutedSound = msg.toUpperCase().includes('SHALLOW SQUAT') || msg.toUpperCase().includes('DEPTH OPTIMAL');
    if ((msg.includes('⚠️') || msg.includes('🟢')) && !isMutedSound) {
      const commandText = msg.replace('⚠️', '').replace('🟢', '').trim().split(':')[0]; // e.g., "SHALLOW SQUAT" or "DEPTH OPTIMAL"
      speakCoachingInstruction(commandText);
    }
  };

  const pushThrottledAlert = (msg: string, debounceMs: number = 3500) => {
    const now = Date.now();
    // Rate limit based on prefix/type key so similar posture issues coalesce beautifully
    const key = msg.split(':')[0] || msg;
    const lastTime = lastAlertTimesRef.current[key] || 0;
    if (now - lastTime < debounceMs) return;
    lastAlertTimesRef.current[key] = now;
    pushAlert(msg);
  };

  // Safe accessor averages
  const avgPrecision = accuracySamples.length > 0 
    ? Math.round(accuracySamples.reduce((a, b) => a + b, 0) / accuracySamples.length)
    : 0;
  
  const avgSymmetry = symmetrySamples.length > 0
    ? Math.round(symmetrySamples.reduce((a, b) => a + b, 0) / symmetrySamples.length)
    : 0;

  const avgPosture = postureSamples.length > 0
    ? Math.round(postureSamples.reduce((a, b) => a + b, 0) / postureSamples.length)
    : 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* 1. Global Navigation Rib */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-6 py-4.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl flex items-center justify-center">
            <Activity className="w-5.5 h-5.5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-md font-black tracking-wider text-slate-100 font-sans uppercase flex items-center gap-1.5">
              MasteryMove
              <span className="text-[10px] font-bold bg-sky-500/15 text-sky-400 px-1.5 py-0.5 rounded border border-sky-500/20">Proto</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Real-time Biometrics Posture Optimization</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-5">
          <div className="text-right font-mono">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Precision Threshold</p>
            <p className="text-xs text-sky-400 font-black flex items-center justify-end gap-1 mt-0.5">
              <Shield className="w-3.5 h-3.5" />
              {tolerance} Standard
            </p>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col justify-start">
        <AnimatePresence mode="wait">
          
          {/* LANDING STATE */}
          {viewState === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-8 flex-1 justify-center align-middle"
            >
              {/* Introduction Hero banner */}
              <div id="hero_header_container" className="text-center max-w-2xl mx-auto flex flex-col items-center pt-4 md:pt-10">
                <div className="inline-flex items-center gap-1.5 bg-indigo-505/10 border border-sky-500/20 text-sky-400 px-3.5 py-1.5 rounded-full text-xs font-bold mb-4 shadow-inner">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  On-Device Vision AI Coaching Engine
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight font-sans">
                  Perfect Mechanics. <br />
                  <span className="bg-gradient-to-r from-sky-450 to-indigo-400 bg-clip-text text-sky-400 font-black">
                    Engineered in Real-Time.
                  </span>
                </h2>
                <p className="text-slate-400 text-sm mt-3 leading-relaxed max-w-xl">
                  Deploy computer vision algorithms straight in your browser window. Measure mechanical joint angles, trace asymmetries, maintain skeletal stiffening targets, and analyze performance with an elite athletic therapist.
                </p>
              </div>

              {/* Category Segmented Control */}
              <div className="flex justify-center -mt-2 mb-2 overflow-x-auto max-w-full">
                <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1.5 shadow-md whitespace-nowrap">
                  <button
                    onClick={() => {
                      setActiveCategory('workouts');
                      setSelectedExercise('Squats');
                    }}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer ${activeCategory === 'workouts' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Dumbbell className="w-4 h-4 shrink-0" />
                    Strength Workouts
                  </button>
                  <button
                    onClick={() => {
                      setActiveCategory('yoga');
                      setSelectedExercise('Warrior II');
                    }}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer ${activeCategory === 'yoga' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Flower2 className="w-4 h-4 shrink-0" />
                    Zen Yoga
                  </button>
                  <button
                    onClick={() => {
                      setActiveCategory('hands_face');
                      setSelectedExercise('Finger Pinch Drill');
                    }}
                    className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer ${activeCategory === 'hands_face' ? 'bg-fuchsia-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Smile className="w-4 h-4 shrink-0" />
                    Hands & Face
                  </button>
                </div>
              </div>

              {/* Exercises Selection grid */}
              <div id="catalog_exercises_deck" className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto w-full">
                {(activeCategory === 'workouts' ? WORKOUT_CATALOG : activeCategory === 'yoga' ? YOGA_CATALOG : HANDS_FACE_CATALOG).map((ex) => {
                  const isSelected = selectedExercise === ex.name;
                  const activeColor = activeCategory === 'workouts' ? 'sky' : activeCategory === 'yoga' ? 'indigo' : 'fuchsia';
                  
                  return (
                    <button
                      key={`${activeCategory}-${ex.name}`}
                      onClick={() => setSelectedExercise(ex.name)}
                      className={`text-left p-5 rounded-2xl border transition-all relative flex flex-col justify-between h-52 group cursor-pointer ${
                        isSelected 
                          ? activeColor === 'sky'
                            ? 'bg-slate-900 border-sky-500 ring-2 ring-sky-500/25 shadow-xl'
                            : activeColor === 'indigo'
                              ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/25 shadow-xl'
                              : 'bg-slate-900 border-fuchsia-500 ring-2 ring-fuchsia-500/25 shadow-xl'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                      }`}
                    >
                      {/* Top icon and label */}
                      <div className="flex justify-between items-start w-full">
                        <div className={`p-2.5 rounded-xl border ${
                          isSelected 
                            ? activeColor === 'sky'
                              ? 'bg-sky-500 text-slate-950 border-sky-450'
                              : activeColor === 'indigo'
                                ? 'bg-indigo-500 text-white border-indigo-400'
                                : 'bg-fuchsia-500 text-white border-fuchsia-400'
                            : 'bg-slate-950 text-slate-400 border-slate-800 group-hover:text-slate-200'
                        }`}>
                          {activeCategory === 'workouts' ? (
                            <Dumbbell className="w-4 h-4" />
                          ) : activeCategory === 'yoga' ? (
                            <Flower2 className="w-4 h-4" />
                          ) : (
                            <Smile className="w-4 h-4" />
                          )}
                        </div>
                        {isSelected && (
                          <span className={`text-[10px] font-extrabold border px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                            activeColor === 'sky'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : activeColor === 'indigo'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'
                          }`}>
                            Selected
                          </span>
                        )}
                      </div>

                      {/* Dec details */}
                      <div className="mt-4">
                        <h3 className="text-base font-black text-slate-50 font-sans">{ex.name}</h3>
                        <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-2">{ex.summary}</p>
                      </div>

                      {/* Bottom target details */}
                      <div className="mt-3 text-[10px] font-bold text-slate-400 border-t border-slate-800/40 pt-2.5 flex items-center justify-between w-full">
                        <span>Target: <strong className={
                          activeColor === 'sky'
                            ? 'text-sky-400'
                            : activeColor === 'indigo'
                              ? 'text-indigo-400'
                              : 'text-fuchsia-400'
                        }>{ex.keyJoints}</strong></span>
                        <span className="truncate max-w-[120px] text-right">{ex.muscles[0]} centric</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Trigger Row */}
              <div className="flex flex-col items-center gap-4 max-w-xs mx-auto pb-8">
                <button
                  onClick={startPractice}
                  className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 py-3.5 px-6 rounded-xl font-extrabold text-sm transition-all shadow-lg cursor-pointer hover:shadow-sky-500/10 transform hover:-translate-y-0.5"
                >
                  Start Practice Session
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-sans">
                  <Shield className="w-3.5 h-3.5 text-slate-500" />
                  Your video is analyzed locally for complete privacy.
                </div>
              </div>
            </motion.div>
          )}

          {/* ACTIVE PRACTICE STATE */}
          {viewState === 'practice' && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-6"
            >
              {/* Session Control header banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-5 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500 text-slate-950 rounded-xl flex items-center justify-center font-bold">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-sans">{selectedExercise} Drill</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Maintain complete flexion targets. Ideal form references are simulated on the right.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-start">
                  <div className="flex flex-wrap items-center gap-4 max-sm:w-full">
                    {/* Duration indicators */}
                    <div className="font-mono text-left max-sm:flex-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Time</p>
                      <p className="text-sm font-black text-slate-200 mt-0.5">
                        {Math.floor(duration / 60)}m {String(duration % 60).padStart(2, '0')}s
                      </p>
                    </div>

                    {/* Live Rep counts / Holds */}
                    <div className="font-mono text-left max-sm:flex-1 pr-4 border-r border-slate-800 flex items-center gap-3">
                      <div>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                          {["Warrior II", "Tree Pose", "Downward Dog", "Cobra Pose"].includes(selectedExercise) ? "Lock Holds" : "Lock Reps"}
                        </p>
                        <p className="text-2xl font-black text-emerald-400 mt-0.5">
                          {repCount}
                        </p>
                      </div>
                      {["Warrior II", "Tree Pose", "Downward Dog", "Cobra Pose"].includes(selectedExercise) && (
                        <div className="pl-3 border-l border-slate-800">
                          <p className="text-[9px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">
                            <Flame className="w-2.5 h-2.5 animate-pulse text-violet-400" /> Active Hold
                          </p>
                          <p className="text-sm font-bold text-slate-250 mt-1">
                            {activeHoldTime.toFixed(1)}s <span className="text-xs text-slate-500">/ 2.0s</span>
                          </p>
                          {activeHoldTime > 0 && (
                            <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-75"
                                style={{ width: `${Math.min(100, (activeHoldTime / 2.0) * 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Voice Link state trigger button */}
                    <div className="flex items-center pr-2 shrink-0">
                      {voiceStatus === "disconnected" && (
                        <button
                          type="button"
                          onClick={() => triggerVoiceConnectRef.current?.()}
                          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-450 text-slate-950 px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md transform hover:-translate-y-0.5 active:scale-95 duration-155 animate-pulse shrink-0"
                          title="Click to activate low-latency real-time voice corrections"
                        >
                          🎙️ Link Coach (Voice)
                        </button>
                      )}
                      {voiceStatus === "connecting" && (
                        <div className="flex items-center gap-1.5 bg-sky-550/10 text-sky-400 px-3.5 py-2 rounded-lg text-[10px] font-extrabold uppercase border border-sky-500/15 shrink-0">
                          <RefreshCw className="w-3 h-3 animate-spin text-sky-450" />
                          <span>CONNECTING...</span>
                        </div>
                      )}
                      {voiceStatus === "error" && (
                        <button
                          type="button"
                          onClick={() => triggerVoiceConnectRef.current?.()}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shrink-0"
                        >
                          ⚠️ Retry Voice
                        </button>
                      )}
                      {voiceStatus === "connected" && (
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-455 border border-emerald-500/15 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          <span>COACH ACTIVE</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={endPractice}
                      className="bg-red-500 hover:bg-red-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all cursor-pointer shadow-md focus:ring-4 focus:ring-red-500/25 shrink-0 transform hover:-translate-y-0.5"
                    >
                      Finish Session
                    </button>
                  </div>
                </div>
              </div>

              {/* 1. Camera & Simulator side-by-side Viewport (Addresses user request 5: "bigger and near the top") */}
              <div className="w-full">
                <CameraView
                  exercise={selectedExercise}
                  isSimulated={isSimulated}
                  setIsSimulated={setIsSimulated}
                  formErrors={formErrors}
                  landmarks={landmarks}
                  setLandmarks={setLandmarks}
                  faceLandmarks={faceLandmarks}
                  setFaceLandmarks={setFaceLandmarks}
                  leftHandLandmarks={leftHandLandmarks}
                  setLeftHandLandmarks={setLeftHandLandmarks}
                  rightHandLandmarks={rightHandLandmarks}
                  setRightHandLandmarks={setRightHandLandmarks}
                  onPoseResults={makePoseAnalytics}
                />
              </div>

              {/* 2. Top-Level Real-Time Biomechanics Dashboard Strip (Addresses user request 5: "with a small deck showing...") */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-xl">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                      SYNC ACCURACY
                    </span>
                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded ${avgPrecision >= 85 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {avgPrecision >= 85 ? 'OPTIMAL' : 'CALCULATING'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-sky-400 font-mono">
                      {avgPrecision > 0 ? `${avgPrecision}%` : '--'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-sans">
                      Target Angle Match
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-sky-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${avgPrecision}%` }} 
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                      BILATERAL EQUILIBRIUM
                    </span>
                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded ${avgSymmetry >= 85 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-500'}`}>
                      {avgSymmetry >= 85 ? 'BALANCED' : 'CALCULATING'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-rose-550 font-mono">
                      {avgSymmetry > 0 ? `${avgSymmetry}%` : '--'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-sans">
                      Limb Differential
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${avgSymmetry}%` }} 
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                      POSTURE STIFFNESS
                    </span>
                    <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded ${avgPosture >= 80 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-500'}`}>
                      {avgPosture >= 80 ? 'STABLE' : 'CALCULATING'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-black text-purple-400 font-mono">
                      {avgPosture > 0 ? `${avgPosture}%` : '--'}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-sans">
                      Trunk Core Rigidness
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${avgPosture}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* 3. Bottom Panels Split Layout Column */}
              <div className="grid lg:grid-cols-12 gap-6 items-stretch">
                {/* Left Area (Takes broader 8-col focus) */}
                <div className="lg:col-span-8 flex flex-col">
                  <MetricsPanel
                    exercise={selectedExercise}
                    precisionScore={avgPrecision}
                    symmetryScore={avgSymmetry}
                    postureScore={avgPosture}
                    tolerance={tolerance}
                    setTolerance={setTolerance}
                    formErrors={formErrors}
                    setFormErrors={setFormErrors}
                    isSimulated={isSimulated}
                    onResetCalibration={resetCalibration}
                    liveComments={liveComments}
                    landmarks={landmarks}
                    faceLandmarks={faceLandmarks}
                    leftHandLandmarks={leftHandLandmarks}
                    rightHandLandmarks={rightHandLandmarks}
                  />
                </div>

                {/* Right Area (Takes 4-col focus) */}
                <div className="lg:col-span-4 flex flex-col justify-between gap-6">
                  {/* Real-time Gemini Live Speech Guidance Session */}
                  <div className="h-full">
                    <LiveCoachPanel
                      exercise={selectedExercise}
                      formErrors={formErrors}
                      repCount={repCount}
                      onStatusChange={setVoiceStatus}
                      triggerConnectRef={triggerVoiceConnectRef}
                      trackingLost={!isSimulated && (!landmarks || landmarks.length === 0)}
                    />

                    {/* Active posture tips card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 mt-5">
                      <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                        Dynamic Postural Cue
                      </h4>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {EXERCISE_CATALOG.find(ex => ex.name === selectedExercise)?.postureTip || HANDS_FACE_CATALOG.find(ex => ex.name === selectedExercise)?.postureTip}
                      </p>
                      <div className="mt-3 flex gap-2 overflow-x-auto select-none border-t border-slate-800/40 pt-3">
                        {EXERCISE_CATALOG.find(ex => ex.name === selectedExercise)?.muscles.map((mus) => (
                          <span key={`${selectedExercise}-${mus}`} className="text-[9px] font-bold bg-slate-950 border border-slate-850 px-2 py-1 rounded text-slate-400 whitespace-nowrap">
                            {mus}
                          </span>
                        )) || HANDS_FACE_CATALOG.find(ex => ex.name === selectedExercise)?.muscles.map((mus) => (
                          <span key={`${selectedExercise}-${mus}`} className="text-[9px] font-bold bg-slate-950 border border-slate-850 px-2 py-1 rounded text-slate-400 whitespace-nowrap">
                            {mus}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* PERFORMANCE RESULTS / SUMMARY STATE */}
          {viewState === 'result' && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <AISummary
                sessionStats={sessionStats}
                onRestartPractice={() => setViewState('landing')}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="bg-slate-950 border-t border-slate-900/60 py-6 text-center text-[11px] text-slate-500 font-sans tracking-wide">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 MasteryMove AI Lab. Local webcam coordinates rendered locally via WebGL/WebAssembly.</p>
          <div className="flex gap-4 items-center">
            <span className="flex items-center gap-1.5 hover:text-slate-400 font-medium cursor-pointer">
              <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />
              Privacy Enforced
            </span>
            <span className="w-1 h-1 bg-slate-800 rounded-full" />
            <span className="hover:text-slate-400 cursor-pointer">Security Sandbox</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
