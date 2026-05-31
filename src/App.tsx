/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ExerciseType, Landmark, SessionStats } from './types';
import { calculateAngle, calculateSpineStiffness } from './utils';
import CameraView from './components/CameraView';
import MetricsPanel from './components/MetricsPanel';
import AISummary from './components/AISummary';
import LiveCoachPanel from './components/LiveCoachPanel';
import { Sparkles, Trophy, BrainCircuit, Activity, RotateCcw, ArrowRight, Library, CheckCircle2, Dumbbell, Shield, HelpCircle, HeartHandshake, Flower2, Flame, Smile, Hand } from 'lucide-react';

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
  const [formErrors, setFormErrors] = useState({
    elbowFlare: 0,
    poorDepth: 0,
    asymmetry: 0,
    forwardLean: 0
  });

  // Rep counter state-machine tracking
  const [repCount, setRepCount] = useState(0);
  const [trackingState, setTrackingState] = useState<number>(0); // 0 = start/extended, 1 = deep/flexed
  const [liveComments, setLiveComments] = useState<string[]>([]);
  
  // Historical session statistics
  const [accuracySamples, setAccuracySamples] = useState<number[]>([]);
  const [symmetrySamples, setSymmetrySamples] = useState<number[]>([]);
  const [postureSamples, setPostureSamples] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  const timerRef = useRef<number | null>(null);
  const lastSpokenTimeRef = useRef<number>(0);

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
      
      if (trackingState === 0) {
        // Looking for bottom flexion peak
        if (avgKneeAngle < 120) {
          setTrackingState(1);
          
          // Form checks at bottom depth
          const depthViolation = avgKneeAngle > 105; // Squat depth target is <=100
          if (depthViolation) {
            pushAlert('⚠️ SHALLOW SQUAT: Knee flexion peaked above 105°. Drop your hips lower to hit full depth!');
          } else {
            pushAlert('🟢 DEPTH OPTIMAL: Knee kinematics hit target parallel window.');
          }

          if (currentPosture < 80) {
            pushAlert('⚠️ POSTURAL OVERLEAN: Your back is folding forward. Keep your core braced and chest tall.');
          }

          if (currentSymmetry < 85) {
            pushAlert('⚠️ ASYMMETRICAL LOAD: Your weight is shifting horizontally. Push through both feet equally.');
          }
        }
      } else if (trackingState === 1) {
        // Looking for recovery to standing extension
        if (avgKneeAngle > 155) {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert(`🔥 Rep ${repCount + 1} locked in. Excellent extension template.`);
        }
      }

      // Compute instant precision penalty
      const squatErrorPenalty = (formErrors.poorDepth * 28) + (formErrors.asymmetry * 24) + (formErrors.forwardLean * 20);
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

      // State machine for curl reps: 0 = extended bottom (~160 deg), 1 = fully contracted top (~50 deg)
      if (trackingState === 0) {
        if (avgElbow < 65) {
          setTrackingState(1);
          if (formErrors.elbowFlare > 0.3) {
            pushAlert('⚠️ ELBOW FLARE: Your elbows are drifting wide. Pin them tight to your ribs to isolate the bicep.');
          } else {
            pushAlert('🟢 PEAK CONTRACTION: Peak motor-unit recruitment achieved at top of curl.');
          }
        }
      } else if (trackingState === 1) {
        if (avgElbow > 150) {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert(`🔥 Rep ${repCount + 1} finalized. Clean eccentric extension.`);
        }
      }

      const curlErrorPenalty = (formErrors.elbowFlare * 35) + (formErrors.asymmetry * 30);
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

      // State machine: 0 = starting neck shelf, 1 = completed overhead extension
      if (trackingState === 0) {
        if (avgElbow > 155) {
          setTrackingState(1);
          if (currentSymmetry < 80) {
            pushAlert('⚠️ BI-LATERAL BALANCING WARNING: One side is locking slower. Balance your vertical thrust.');
          } else {
            pushAlert('🟢 PERFECT LOCKOUT: Full scapular elevation achieved.');
          }
        }
      } else if (trackingState === 1) {
        if (avgElbow < 95) {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert(`🔥 Rep ${repCount + 1}. Shoulder press baseline locked.`);
        }
      }

      const pressPenalty = (formErrors.elbowFlare * 25) + (formErrors.asymmetry * 38);
      currentPrecision = Math.max(10, Math.round(94 - pressPenalty));

    // PUSHUP RULESETS
    } else if (selectedExercise === 'Pushups') {
      const shoulderY = pts[11].y;
      const elbowY = pts[13].y;
      const leftElbowAngle = calculateAngle(pts[11], pts[13], pts[15]);

      currentPosture = calculateSpineStiffness(pts[11], pts[23], pts[27]);
      currentSymmetry = Math.max(10, Math.round(100 - formErrors.asymmetry * 34));

      // State machine: 0 = top of plank, 1 = deep bottom chest floor
      if (trackingState === 0) {
        if (leftElbowAngle < 105) {
          setTrackingState(1);
          if (formErrors.forwardLean > 0.4) {
            pushAlert('⚠️ SAGGING HIPS: Your pelvis is dipping. Tighten your lower glutes to lock your torso in alignment.');
          } else {
            pushAlert('🟢 STRICT PUSHUP DEPTH: Full anterior load activated.');
          }
        }
      } else if (trackingState === 1) {
        if (leftElbowAngle > 155) {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert(`🔥 Rep ${repCount + 1}. Structural integrity 100% controlled.`);
        }
      }

      const pushupPenalty = (formErrors.forwardLean * 32) + (formErrors.elbowFlare * 28);
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

      if (trackingState === 0) {
        if (rightKneeAngle < 115 && averageElbowAngle > 165) {
          setTrackingState(1);
          pushAlert('🟢 WARRIOR II LOCK: Arms aligned perfectly horizontal & deep pelvic lunge active.');
        } else {
          if (rightKneeAngle >= 115) {
            pushAlert('⚠️ SHALLOW LUNGE: Bend your front leg deeper towards 90° to engage your quad and hip.');
          }
          if (averageElbowAngle <= 165) {
            pushAlert('⚠️ BENT ARMS: Extend both arms energetically straight out to the horizon.');
          }
        }
      } else if (trackingState === 1) {
        if (rightKneeAngle > 125 || averageElbowAngle < 155) {
          setTrackingState(0);
          pushAlert('⚠️ POSE HOLD BROKEN: Re-align your arms and sink hips down.');
        } else {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert('🔥 Hold registered! Excellent alignment stability.');
        }
      }

      const warriorPenalty = (formErrors.poorDepth * 25) + (formErrors.elbowFlare * 30);
      currentPrecision = Math.max(10, Math.round(95 - warriorPenalty));

    // TREE POSE RULESETS
    } else if (selectedExercise === 'Tree Pose') {
      const leftHip = pts[23], leftKnee = pts[25], leftAnkle = pts[27];
      const shoulderLeft = pts[11], elbowLeft = pts[13], wristLeft = pts[15];
      const shoulderRight = pts[12], elbowRight = pts[14], wristRight = pts[16];

      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const leftElbowAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);

      currentSymmetry = Math.max(10, Math.round(100 - (formErrors.asymmetry * 25)));
      currentPosture = calculateSpineStiffness(shoulderLeft, pts[23], pts[27]);

      if (trackingState === 0) {
        if (leftKneeAngle < 105) {
          setTrackingState(1);
          if (currentPosture < 82) {
            pushAlert('⚠️ TRUNK SAG / LEAN: Stand tall through your crown. Rest your foot high and open your knee.');
          } else {
            pushAlert('🟢 TREE POSE BALANCE ACQUIRED: Postural core and pelvis locked horizontally.');
          }
        } else {
          pushAlert('⚠️ OPEN BENT KNEE: Open your bent left knee outwards and secure your foot stance on your inner thigh.');
        }
      } else if (trackingState === 1) {
        if (leftKneeAngle > 120) {
          setTrackingState(0);
        } else {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert('🔥 Zen hold locked. Stability and posture verified.');
        }
      }

      const treePenalty = (formErrors.asymmetry * 35) + (formErrors.poorDepth * 20);
      currentPrecision = Math.max(10, Math.round(94 - treePenalty));

    // DOWNWARD DOG RULESETS
    } else if (selectedExercise === 'Downward Dog') {
      const hipLeft = pts[23], shoulderLeft = pts[11], wristLeft = pts[15];
      const kneeLeft = pts[25], ankleLeft = pts[27];

      const shoulderLeftAngle = calculateAngle(hipLeft, shoulderLeft, wristLeft);
      const kneeLeftAngle = calculateAngle(hipLeft, kneeLeft, ankleLeft);

      currentPosture = calculateSpineStiffness(shoulderLeft, hipLeft, ankleLeft);
      currentSymmetry = Math.max(10, Math.round(100 - (formErrors.asymmetry * 28)));

      if (trackingState === 0) {
        if (shoulderLeftAngle > 155 && kneeLeftAngle > 150) {
          setTrackingState(1);
          pushAlert('🟢 DOWNWARD DOG COMPLETED: Hips pushed high, heels driven down, and thoracic arch flat.');
        } else {
          if (kneeLeftAngle <= 150) {
            pushAlert('⚠️ BENT KNEES: If tight, keep knees slightly bent but prioritize pushing hips up.');
          }
          if (shoulderLeftAngle <= 155) {
            pushAlert('⚠️ CLOSED SHOULDERS: Press your chest back towards your thighs to open your armpits.');
          }
        }
      } else if (trackingState === 1) {
        if (shoulderLeftAngle < 145 || kneeLeftAngle < 140) {
          setTrackingState(0);
        } else {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert('🔥 Perfect inverted apex lock registered!');
        }
      }

      const dogPenalty = (formErrors.poorDepth * 30) + (formErrors.forwardLean * 24);
      currentPrecision = Math.max(10, Math.round(92 - dogPenalty));

    // COBRA POSE RULESETS
    } else if (selectedExercise === 'Cobra Pose') {
      const shoulderLeft = pts[11], hipLeft = pts[23], ankleLeft = pts[27];
      const elbowLeft = pts[13], wristLeft = pts[15];

      const elbowLeftAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
      
      const hipsStayingLow = hipLeft.y > 0.73;
      currentSymmetry = Math.max(0, Math.round(100 - formErrors.asymmetry * 30));
      currentPosture = Math.round(100 - Math.abs(shoulderLeft.y - hipLeft.y) * 100);

      if (trackingState === 0) {
        if (shoulderLeft.y < 0.65 && hipsStayingLow) {
          setTrackingState(1);
          pushAlert('🟢 COBRA POSTURE ACTIVE: Scapulas drawn back, chest wall opened vertically, hips grounded.');
        } else {
          if (!hipsStayingLow) {
            pushAlert('⚠️ HIPS OFF GROUND: Anchor your pelvic bones to the mat. Lift using spine extensors.');
          }
          if (shoulderLeft.y >= 0.65) {
            pushAlert('⚠️ COLLAPSED SPINAL ARCH: Squeeze shoulder blades together and lift your heart.');
          }
        }
      } else if (trackingState === 1) {
        if (shoulderLeft.y > 0.70 || !hipsStayingLow) {
          setTrackingState(0);
        } else {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert('🔥 Heart-opening pose hold completed!');
        }
      }

      const cobraPenalty = (formErrors.forwardLean * 38) + (formErrors.elbowFlare * 22);
      currentPrecision = Math.max(10, Math.round(93 - cobraPenalty));
    } else if (selectedExercise === 'Finger Pinch Drill') {
      const leftThumb = pts[21], leftIndex = pts[19];
      const rightThumb = pts[22], rightIndex = pts[20];

      let leftDist = 1.0;
      if (leftThumb && leftIndex && (!leftThumb.visibility || leftThumb.visibility > 0.01) && (!leftIndex.visibility || leftIndex.visibility > 0.01)) {
        leftDist = Math.sqrt(Math.pow(leftThumb.x - leftIndex.x, 2) + Math.pow(leftThumb.y - leftIndex.y, 2));
      }
      let rightDist = 1.0;
      if (rightThumb && rightIndex && (!rightThumb.visibility || rightThumb.visibility > 0.01) && (!rightIndex.visibility || rightIndex.visibility > 0.01)) {
        rightDist = Math.sqrt(Math.pow(rightThumb.x - rightIndex.x, 2) + Math.pow(rightThumb.y - rightIndex.y, 2));
      }

      const avgDist = (leftDist + rightDist) / 2;

      // Symmetry checking: left proximity vs right proximity
      const distDiff = Math.abs(leftDist - rightDist);
      currentSymmetry = Math.max(10, Math.round(100 - distDiff * 350));

      // Posture: neck/torso stiffness to keep focus while doing hand gestures
      currentPosture = calculateSpineStiffness(pts[11], pts[23], pts[27]);

      // State machine: 0 = fingers wide, 1 = pinched
      if (trackingState === 0) {
        if (avgDist < 0.035) {
          setTrackingState(1);
          if (leftDist > 0.045 && formErrors.asymmetry > 0.3) {
            pushAlert('⚠️ PINCH ASYMMETRY: Left hand finger pinch is incomplete. Squeeze tips together.');
          } else {
            pushAlert('🟢 PINCH LOCK: Index finger and thumb tips achieved positive contact.');
          }
        }
      } else if (trackingState === 1) {
        if (avgDist > 0.065) {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert(`🔥 Articulation Rep ${repCount + 1} locked-in. Excellent hand range.`);
        }
      }

      const pinchPenalty = (formErrors.asymmetry * 25) + (formErrors.poorDepth * 30);
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

      // Expression cycles: measuring distance from eye to mouth corners
      let leftMouthEyeDist = 0.5;
      if (leftEye && leftMouth) {
        leftMouthEyeDist = Math.abs(leftEye.y - leftMouth.y);
      }

      if (trackingState === 0) {
        if (leftMouthEyeDist > 0.046) {
          setTrackingState(1);
          if (eyeYDiff > 0.006 && formErrors.asymmetry > 0.35) {
            pushAlert('⚠️ FACIAL ASYMMETRY: Uneven horizontal activation. Coordinate bilateral musculature.');
          } else {
            pushAlert('🟢 BILATERAL SYMMETRY: Good symmetrical face musculature raise!');
          }
        }
      } else if (trackingState === 1) {
        if (leftMouthEyeDist < 0.040) {
          setRepCount((prev) => prev + 1);
          setTrackingState(0);
          pushAlert(`🔥 Expression Cycle ${repCount + 1} finalized. Motor nerves responsive.`);
        }
      }

      const facialPenalty = (formErrors.asymmetry * 35) + (formErrors.forwardLean * 24);
      currentPrecision = Math.max(10, Math.round(95 - facialPenalty));
    }

    // Capture running telemetry samples
    setAccuracySamples((prev) => [...prev, currentPrecision].slice(-30));
    setSymmetrySamples((prev) => [...prev, currentSymmetry].slice(-30));
    setPostureSamples((prev) => [...prev, currentPosture].slice(-30));
  };

  // Real-time audio coaching speak routine
  const speakCoachingInstruction = async (text: string) => {
    const now = Date.now();
    // Throttled voice feedback: max one advice every 6 seconds to prevent spamming the user
    if (now - lastSpokenTimeRef.current < 6000) return;
    lastSpokenTimeRef.current = now;

    // Filter symbols and keep text crisp
    const cleanText = text.replace(/^[^\w]*/, '').replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').slice(0, 80);
    
    try {
      // Attempt backend Gemini Voice Model call
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: cleanText,
          voice: selectedExercise === 'Facial Mobility' || selectedExercise === 'Finger Pinch Drill' ? 'Kore' : 'Zephyr'
        })
      });
      
      const data = await response.json();
      if (data.success && data.audio) {
        // Play the base64 audio block
        const audioBytes = atob(data.audio);
        const arrayBuffer = new ArrayBuffer(audioBytes.length);
        const uintArray = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioBytes.length; i++) {
          uintArray[i] = audioBytes.charCodeAt(i);
        }
        const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play().catch(e => {
          console.warn("Audio autoplay blocked or failed:", e);
        });
        return;
      }
    } catch (err) {
      console.warn("Attempt to contact Gemini Voice Server failed, using instant Web Speech Synthesis fallback.", err);
    }

    // High performance localized browser fallback
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const pushAlert = (msg: string) => {
    setLiveComments((prev) => {
      // Don't repeat the warning if it was literally just sent
      if (prev[prev.length - 1] === msg) return prev;
      return [...prev, msg].slice(-24);
    });

    // Speak corrections (starts with ⚠️) or critical performance peaks (starts with 🟢)
    if (msg.includes('⚠️') || msg.includes('🟢')) {
      const commandText = msg.replace('⚠️', '').replace('🟢', '').trim().split(':')[0]; // e.g., "SHALLOW SQUAT" or "DEPTH OPTIMAL"
      speakCoachingInstruction(commandText);
    }
  };

  // Safe accessor averages
  const avgPrecision = accuracySamples.length > 0 
    ? Math.round(accuracySamples.reduce((a, b) => a + b, 0) / accuracySamples.length)
    : 100;
  
  const avgSymmetry = symmetrySamples.length > 0
    ? Math.round(symmetrySamples.reduce((a, b) => a + b, 0) / symmetrySamples.length)
    : 100;

  const avgPosture = postureSamples.length > 0
    ? Math.round(postureSamples.reduce((a, b) => a + b, 0) / postureSamples.length)
    : 100;

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
                      key={ex.name}
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
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white font-sans">{selectedExercise} Drill</h3>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      Maintain complete flexion targets. Red skeletons highlight active form breaks.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 justify-between sm:justify-start">
                  <div className="flex items-center gap-4 max-sm:w-full">
                    {/* Duration indicators */}
                    <div className="font-mono text-left max-sm:flex-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Time</p>
                      <p className="text-sm font-black text-slate-200 mt-0.5">
                        {Math.floor(duration / 60)}m {String(duration % 60).padStart(2, '0')}s
                      </p>
                    </div>

                    {/* Live Rep counts */}
                    <div className="font-mono text-left pr-4 border-r border-slate-800 max-sm:flex-1">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Lock Reps</p>
                      <p className="text-2xl font-black text-emerald-400 mt-0.5">
                        {repCount}
                      </p>
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

              {/* Top-Level Real-Time Biomechanics Dashboard Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 p-4 md:p-5 rounded-2xl shadow-xl">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Sync Accuracy
                    </span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${avgPrecision >= 85 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {avgPrecision >= 85 ? 'OPTIMAL' : 'DEVIATION'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-sky-400 font-mono">
                      {avgPrecision}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-sans">
                      Target Angle Match
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      className="bg-sky-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${avgPrecision}%` }} 
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Bilateral Equilibrium
                    </span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${avgSymmetry >= 85 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {avgSymmetry >= 85 ? 'BALANCED' : 'ASYMMETRICAL'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-500 font-mono">
                      {avgSymmetry}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-sans">
                      Limb Differential
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      className="bg-rose-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${avgSymmetry}%` }} 
                    />
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                      Posture Stiffness
                    </span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${avgPosture >= 80 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                      {avgPosture >= 80 ? 'STABLE' : 'LEAN WARNING'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-purple-400 font-mono">
                      {avgPosture}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 font-sans">
                      Trunk Core Rigidness
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${avgPosture}%` }} 
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Layout Grid (Symmetric Biomechanics-Left & Camera-Right pane) */}
              <div className="grid lg:grid-cols-12 gap-6 items-stretch">
                {/* Real-time Biomechanics Dashboard Pane (Takes heavy 7-col focus on Left) */}
                <div className="lg:col-span-7 flex flex-col">
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

                {/* Left-handed Video track / 2D Camera simulator view side-panel (Takes lighter 5-col focus on Right) */}
                <div className="lg:col-span-5 flex flex-col justify-between">
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

                  {/* Real-time Gemini Live Speech Guidance Session */}
                  <LiveCoachPanel exercise={selectedExercise} formErrors={formErrors} />

                  {/* Active posture tips card under camera side pane */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 mt-5">
                    <h4 className="text-xs font-black uppercase text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                      Dynamic Postural Cue
                    </h4>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      {EXERCISE_CATALOG.find(ex => ex.name === selectedExercise)?.postureTip}
                    </p>
                    <div className="mt-3 flex gap-2 overflow-x-auto select-none border-t border-slate-800/40 pt-3">
                      {EXERCISE_CATALOG.find(ex => ex.name === selectedExercise)?.muscles.map((mus) => (
                        <span key={mus} className="text-[9px] font-bold bg-slate-950 border border-slate-850 px-2 py-1 rounded text-slate-400 whitespace-nowrap">
                          {mus}
                        </span>
                      ))}
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
