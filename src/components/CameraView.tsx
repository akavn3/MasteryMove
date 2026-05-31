import { useEffect, useRef, useState } from 'react';
import { Landmark, ExerciseType } from '../types';
import { calculateAngle, getSimulatedLandmarks } from '../utils';
import { Camera, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface CameraViewProps {
  exercise: ExerciseType;
  isSimulated: boolean;
  setIsSimulated: (val: boolean) => void;
  formErrors: {
    elbowFlare: number;
    poorDepth: number;
    asymmetry: number;
    forwardLean: number;
  };
  landmarks: Landmark[];
  setLandmarks: (landmarks: Landmark[]) => void;
  faceLandmarks: Landmark[];
  setFaceLandmarks: (faceLandmarks: Landmark[]) => void;
  leftHandLandmarks: Landmark[];
  setLeftHandLandmarks: (leftHandLandmarks: Landmark[]) => void;
  rightHandLandmarks: Landmark[];
  setRightHandLandmarks: (rightHandLandmarks: Landmark[]) => void;
  onPoseResults?: (landmarks: Landmark[]) => void;
}

const NEON_COLORS = [
  { name: 'Emerald', joint: 'rgba(34, 197, 94, 0.75)', value: '#22c55e' },
  { name: 'Aqua', joint: 'rgba(6, 182, 212, 0.8)', value: '#06b6d4' },
  { name: 'Cobalt', joint: 'rgba(59, 130, 246, 0.8)', value: '#3b82f6' },
  { name: 'Gold', joint: 'rgba(234, 179, 8, 0.8)', value: '#eab308' }
];

export default function CameraView({
  exercise,
  isSimulated,
  setIsSimulated,
  formErrors,
  landmarks,
  setLandmarks,
  faceLandmarks,
  setFaceLandmarks,
  leftHandLandmarks,
  setLeftHandLandmarks,
  rightHandLandmarks,
  setRightHandLandmarks,
  onPoseResults
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  // Custom neon theme color selection
  const [perfectFormColor, setPerfectFormColor] = useState<string>('rgba(34, 197, 94, 0.75)');

  // Control MediaPipe Holistic frame rate to stop lagginess
  const holisticInstanceRef = useRef<any>(null);
  const processingRef = useRef<boolean>(false);
  const activeDetectionRef = useRef<boolean>(false);
  const lastRunTimeRef = useRef<number>(0);

  // Simulation Loop parameters
  const [simProgress, setSimProgress] = useState(0);
  const requestRef = useRef<number | null>(null);
  const prevTimeRef = useRef<number | null>(null);

  // 1. Simulator animation loop
  useEffect(() => {
    let speedMultiplier = 1.0;
    if (exercise === 'Pushups') speedMultiplier = 0.8;
    
    const animateSimulation = (time: number) => {
      if (prevTimeRef.current !== null) {
        const delta = (time - prevTimeRef.current) / 1000;
        setSimProgress((prev) => {
          const next = prev + (delta * 0.35 * speedMultiplier);
          return next > 1 ? next - 1 : next;
        });
      }
      prevTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animateSimulation);
    };

    if (isSimulated) {
      requestRef.current = requestAnimationFrame(animateSimulation);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      prevTimeRef.current = null;
    };
  }, [isSimulated, exercise]);

  // Map landmarks simulation
  useEffect(() => {
    if (isSimulated) {
      const motionFactor = 0.5 - 0.5 * Math.cos(simProgress * Math.PI * 2);
      const simPoints = getSimulatedLandmarks(exercise, motionFactor, formErrors);
      setLandmarks(simPoints);
      if (onPoseResults) onPoseResults(simPoints);

      // Generate facial mesh background details
      const nosePoint = simPoints[0] || { x: 0.5, y: 0.17, z: 0 };
      const simulatedFace: Landmark[] = [];
      const tiltOffset = formErrors.forwardLean * 0.02 * Math.sin(Date.now() / 1500);

      for (let r = 0; r < 18; r++) {
        const phi = (r / 18) * Math.PI;
        for (let c = 0; c < 26; c++) {
          const theta = (c / 26) * 2 * Math.PI;
          const rx = 0.038 * Math.sin(phi) * Math.cos(theta);
          const ry = 0.052 * Math.cos(phi);
          const rz = 0.028 * Math.sin(phi) * Math.sin(theta);
          simulatedFace.push({
            x: nosePoint.x + rx + tiltOffset,
            y: nosePoint.y - 0.02 + ry,
            z: rz
          });
        }
      }
      setFaceLandmarks(simulatedFace.slice(0, 468));

      // Left hand coordinates
      const leftWrist = simPoints[15] || { x: 0.42, y: 0.58, z: -0.1 };
      const simLeftHand: Landmark[] = [];
      simLeftHand.push({ x: leftWrist.x, y: leftWrist.y, z: leftWrist.z || 0 });
      for (let f = 1; f <= 4; f++) {
        simLeftHand.push({
          x: leftWrist.x + (0.01 - motionFactor * 0.015) * (f / 4),
          y: leftWrist.y - (0.025 + motionFactor * 0.02) * (f / 4),
          z: (leftWrist.z || 0) + 0.01
        });
      }
      for (let f = 1; f <= 4; f++) {
        simLeftHand.push({
          x: leftWrist.x - (0.02 - motionFactor * 0.015) * (f / 4),
          y: leftWrist.y - (0.06 - motionFactor * 0.015) * (f / 4),
          z: (leftWrist.z || 0) - 0.02
        });
      }
      for (let f = 1; f <= 4; f++) {
        simLeftHand.push({
          x: leftWrist.x - 0.01 * (f / 4),
          y: leftWrist.y - 0.075 * (f / 4),
          z: (leftWrist.z || 0) - 0.03
        });
      }
      for (let f = 1; f <= 4; f++) {
        simLeftHand.push({
          x: leftWrist.x + 0.005 * (f / 4),
          y: leftWrist.y - 0.07 * (f / 4),
          z: (leftWrist.z || 0) - 0.03
        });
      }
      for (let f = 1; f <= 4; f++) {
        simLeftHand.push({
          x: leftWrist.x + 0.022 * (f / 4),
          y: leftWrist.y - 0.058 * (f / 4),
          z: (leftWrist.z || 0) - 0.02
        });
      }
      setLeftHandLandmarks(simLeftHand);

      // Right hand coordinates
      const rightWrist = simPoints[16] || { x: 0.58, y: 0.58, z: 0.1 };
      const rightPinchFactor = motionFactor * (1 - formErrors.asymmetry * 0.4);
      const simRightHand: Landmark[] = [];
      simRightHand.push({ x: rightWrist.x, y: rightWrist.y, z: rightWrist.z || 0 });
      for (let f = 1; f <= 4; f++) {
        simRightHand.push({
          x: rightWrist.x - (0.01 - rightPinchFactor * 0.015) * (f / 4),
          y: rightWrist.y - (0.025 + rightPinchFactor * 0.02) * (f / 4),
          z: (rightWrist.z || 0) + 0.01
        });
      }
      for (let f = 1; f <= 4; f++) {
        simRightHand.push({
          x: rightWrist.x + (0.02 - rightPinchFactor * 0.015) * (f / 4),
          y: rightWrist.y - (0.06 - rightPinchFactor * 0.015) * (f / 4),
          z: (rightWrist.z || 0) - 0.02
        });
      }
      for (let f = 1; f <= 4; f++) {
        simRightHand.push({
          x: rightWrist.x + 0.01 * (f / 4),
          y: rightWrist.y - 0.075 * (f / 4),
          z: (rightWrist.z || 0) - 0.03
        });
      }
      for (let f = 1; f <= 4; f++) {
        simRightHand.push({
          x: rightWrist.x - 0.005 * (f / 4),
          y: rightWrist.y - 0.07 * (f / 4),
          z: (rightWrist.z || 0) - 0.03
        });
      }
      for (let f = 1; f <= 4; f++) {
        simRightHand.push({
          x: rightWrist.x - 0.022 * (f / 4),
          y: rightWrist.y - 0.058 * (f / 4),
          z: (rightWrist.z || 0) - 0.02
        });
      }
      setRightHandLandmarks(simRightHand);
    }
  }, [isSimulated, simProgress, exercise, formErrors]);

  const stopWebcam = () => {
    activeDetectionRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startWebcam = async () => {
    setPermissionError(null);
    setLoadingModel(true);
    setIsSimulated(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((err) => {
          console.warn("Video stream access delayed:", err);
        });
        setCameraActive(true);
        loadMediaPipeHolistic();
      } else {
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((e) => console.warn(e));
            setCameraActive(true);
            loadMediaPipeHolistic();
          } else {
            setPermissionError("Camera container failed to resolve. Please reset simulator.");
            setIsSimulated(true);
            setLoadingModel(false);
          }
        }, 150);
      }
    } catch (err: any) {
      console.error("Camera access denied:", err);
      setPermissionError("Access to webcam denied. Engaging Virtual Pose Simulator instead.");
      setIsSimulated(true);
      setLoadingModel(false);
    }
  };

  const loadMediaPipeHolistic = async () => {
    try {
      const HolisticClass = (window as any).Holistic;
      if (!HolisticClass) {
        console.warn("Holistic script loading. Retrying...");
        setTimeout(loadMediaPipeHolistic, 500);
        return;
      }

      if (holisticInstanceRef.current) {
        setLoadingModel(false);
        runHolisticDetection();
        return;
      }

      const holistic = new HolisticClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
      });

      holistic.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        refineFaceLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      holistic.onResults((results: any) => {
        if (isSimulated) return;

        let points: Landmark[] = [];
        if (results.poseLandmarks) {
          points = results.poseLandmarks.map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z || 0,
            visibility: pt.visibility !== undefined ? pt.visibility : 0.9
          }));
          setLandmarks(points);
          if (onPoseResults) onPoseResults(points);
        }

        if (results.faceLandmarks) {
          const facePoints: Landmark[] = results.faceLandmarks.map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z || 0
          }));
          setFaceLandmarks(facePoints);
        } else {
          setFaceLandmarks([]);
        }

        if (results.leftHandLandmarks) {
          const lHandPoints: Landmark[] = results.leftHandLandmarks.map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z || 0
          }));
          setLeftHandLandmarks(lHandPoints);
        } else {
          setLeftHandLandmarks([]);
        }

        if (results.rightHandLandmarks) {
          const rHandPoints: Landmark[] = results.rightHandLandmarks.map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z || 0
          }));
          setRightHandLandmarks(rHandPoints);
        } else {
          setRightHandLandmarks([]);
        }
      });

      holisticInstanceRef.current = holistic;
      setLoadingModel(false);
      runHolisticDetection();
    } catch (e: any) {
      console.error("Holistic init error:", e);
      setPermissionError("Could not initialize tracking framework. Resorting to Simulator model.");
      setIsSimulated(true);
      setLoadingModel(false);
    }
  };

  const runHolisticDetection = () => {
    activeDetectionRef.current = true;
    let lastVideoTime = -1;

    const detectFrame = async () => {
      if (!activeDetectionRef.current || isSimulated) return;

      const now = Date.now();
      // Throttle inference frame rate to ~12 FPS to eradicate CPU lagginess completely
      if (now - lastRunTimeRef.current < 85) {
        if (activeDetectionRef.current && !isSimulated) {
          requestAnimationFrame(detectFrame);
        }
        return;
      }

      if (videoRef.current && holisticInstanceRef.current && !processingRef.current) {
        const video = videoRef.current;
        if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          try {
            processingRef.current = true;
            lastRunTimeRef.current = now;
            await holisticInstanceRef.current.send({ image: video });
          } catch (err) {
            console.warn("Holistic dispatch error:", err);
          } finally {
            processingRef.current = false;
          }
        }
      }

      if (activeDetectionRef.current && !isSimulated) {
        requestAnimationFrame(detectFrame);
      }
    };

    requestAnimationFrame(detectFrame);
  };

  useEffect(() => {
    if (!isSimulated) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isSimulated]);

  // Canvas drawing effect loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (landmarks.length > 0) {
      const width = canvas.width;
      const height = canvas.height;

      // Correctly mirror landmark coordinates in code so overlay text is never backwards!
      const getPos = (landmark: Landmark) => ({
        x: Math.round((1 - landmark.x) * width),
        y: Math.round(landmark.y * height)
      });

      // Real-time error highlight variables and levels
      const getErrorLevel = (value: number): 'perfect' | 'warning' | 'error' => {
        if (value > 0.25) return 'error';
        if (value > 0.10) return 'warning';
        return 'perfect';
      };

      const squatDepthLevel = exercise === 'Squats' ? getErrorLevel(formErrors.poorDepth) : 'perfect';
      const leanLevel = getErrorLevel(formErrors.forwardLean);
      const asymmetryLevel = getErrorLevel(formErrors.asymmetry);
      const elbowFlareLevel = (exercise === 'Bicep Curls' || exercise === 'Pushups' || exercise === 'Overhead Press') 
        ? getErrorLevel(formErrors.elbowFlare) 
        : 'perfect';

      // Draw Bones with optional dynamic error highlights (perfect = green/theme, warning = yellow/gold, error = red)
      const drawBone = (idA: number, idB: number, errorLevel: 'perfect' | 'warning' | 'error' = 'perfect') => {
        const ptA = landmarks[idA];
        const ptB = landmarks[idB];
        if (!ptA || !ptB || (ptA.visibility !== undefined && ptA.visibility < 0.05) || (ptB.visibility !== undefined && ptB.visibility < 0.05)) return;

        const pA = getPos(ptA);
        const pB = getPos(ptB);

        let color = perfectFormColor;
        let shadowBlur = 0;
        
        if (errorLevel === 'error') {
          color = 'rgb(239, 68, 68)'; // HOT RED (Pose correction highlighted)
          shadowBlur = 12;
        } else if (errorLevel === 'warning') {
          color = 'rgb(234, 179, 8)'; // WARNING YELLOW / GOLD
          shadowBlur = 8;
        }

        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.shadowBlur = shadowBlur;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      let leftKneeAngle = 180;
      let rightKneeAngle = 180;
      let leftElbowAngle = 180;
      let rightElbowAngle = 180;

      if (landmarks[23] && landmarks[25] && landmarks[27]) {
        leftKneeAngle = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
      }
      if (landmarks[24] && landmarks[26] && landmarks[28]) {
        rightKneeAngle = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
      }
      if (landmarks[11] && landmarks[13] && landmarks[15]) {
        leftElbowAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
      }
      if (landmarks[12] && landmarks[14] && landmarks[16]) {
        rightElbowAngle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
      }

      // 1. Draw Core Pose Skeleton Links with rich multi-tier color states (Always-On Complete Body Mapping)
      // Torso Frame
      drawBone(11, 12); // Shoulders
      drawBone(23, 24); // Hips
      drawBone(11, 23, leanLevel); // Left flank torso
      drawBone(12, 24, leanLevel); // Right flank torso

      // Core Upper Body Arms
      drawBone(11, 13, elbowFlareLevel);
      drawBone(13, 15, elbowFlareLevel);
      drawBone(12, 14, elbowFlareLevel === 'perfect' ? asymmetryLevel : elbowFlareLevel);
      drawBone(14, 16, elbowFlareLevel === 'perfect' ? asymmetryLevel : elbowFlareLevel);

      // Core Lower Body Legs
      drawBone(23, 25, squatDepthLevel);
      drawBone(25, 27, squatDepthLevel);
      drawBone(24, 26, squatDepthLevel === 'perfect' ? (exercise === 'Squats' ? asymmetryLevel : 'perfect') : squatDepthLevel);
      drawBone(26, 28, squatDepthLevel === 'perfect' ? (exercise === 'Squats' ? asymmetryLevel : 'perfect') : squatDepthLevel);

      // Complete Terminal Feet & Heels alignment mapping
      drawBone(27, 29); drawBone(29, 31); drawBone(27, 31);
      drawBone(28, 30); drawBone(30, 32); drawBone(28, 32);

      // Metacarpal wrist anchors
      drawBone(15, 17); drawBone(15, 19); drawBone(15, 21);
      drawBone(16, 18); drawBone(16, 20); drawBone(16, 22);

      // Face tracking skeleton elements if detailed mesh is unavailable
      if (!faceLandmarks || faceLandmarks.length === 0) {
        drawBone(0, 1); drawBone(0, 2); drawBone(1, 3); drawBone(2, 4);
        drawBone(0, 5); drawBone(0, 6); drawBone(3, 7); drawBone(4, 8);
      }

      // Helper helper to draw hand links
      const drawHandBone = (handPoints: Landmark[], iA: number, iB: number) => {
        if (!handPoints[iA] || !handPoints[iB]) return;
        const p1 = getPos(handPoints[iA]);
        const p2 = getPos(handPoints[iB]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = perfectFormColor;
        ctx.lineWidth = 2.0;
        ctx.stroke();
      };

      // 2. Render Hand Landmarks and Multi-Finger Articulations
      const renderFingerHand = (handPoints: Landmark[]) => {
        if (!handPoints || handPoints.length === 0) return;
        
        // Connect finger lines
        for (let f = 0; f < 5; f++) {
          const base = f * 4 + 1;
          drawHandBone(handPoints, 0, base);
          drawHandBone(handPoints, base, base + 1);
          drawHandBone(handPoints, base + 1, base + 2);
          drawHandBone(handPoints, base + 2, base + 3);
        }

        // Draw palm closures
        drawHandBone(handPoints, 5, 9);
        drawHandBone(handPoints, 9, 13);
        drawHandBone(handPoints, 13, 17);
        drawHandBone(handPoints, 0, 5);
        drawHandBone(handPoints, 0, 17);

        // Draw high fidelity metacarpal node joints
        for (let i = 0; i < handPoints.length; i++) {
          const coord = getPos(handPoints[i]);
          ctx.beginPath();
          ctx.arc(coord.x, coord.y, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = perfectFormColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      };

      if (leftHandLandmarks && leftHandLandmarks.length > 0) {
        renderFingerHand(leftHandLandmarks);
      }
      if (rightHandLandmarks && rightHandLandmarks.length > 0) {
        renderFingerHand(rightHandLandmarks);
      }

      if (exercise === 'Finger Pinch Drill' && rightHandLandmarks.length > 8) {
        const thumbTip = rightHandLandmarks[4];
        const indexTip = rightHandLandmarks[8];
        if (thumbTip && indexTip) {
          const pThumb = getPos(thumbTip);
          const pIndex = getPos(indexTip);
          ctx.font = '700 9px monospace';
          ctx.fillStyle = perfectFormColor;
          ctx.fillText(`CONTACT GAP`, (pThumb.x + pIndex.x) / 2 + 8, (pThumb.y + pIndex.y) / 2 - 2);
        }
      }

      // 3. Render Sci-Fi Holographic Face Mesh Mapping
      if (faceLandmarks && faceLandmarks.length > 0) {
        // Draw downsampled scatter dots
        ctx.fillStyle = perfectFormColor.replace(/[\d\.]+\)$/, '0.4)');
        for (let i = 0; i < faceLandmarks.length; i += 3) {
          const pt = faceLandmarks[i];
          const coord = getPos(pt);
          ctx.beginPath();
          ctx.arc(coord.x, coord.y, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }

        // Segment connections helper for major features
        const drawFaceSegment = (indices: number[]) => {
          ctx.strokeStyle = perfectFormColor.replace(/[\d\.]+\)$/, '0.25)');
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let i = 0; i < indices.length; i++) {
            const pt = faceLandmarks[indices[i]];
            if (!pt) continue;
            const coord = getPos(pt);
            if (i === 0) ctx.moveTo(coord.x, coord.y);
            else ctx.lineTo(coord.x, coord.y);
          }
          ctx.stroke();
        };

        // Render features contours
        drawFaceSegment([70, 63, 105, 66, 107]); // Left eyebrow
        drawFaceSegment([336, 296, 334, 293, 300]); // Right eyebrow
        drawFaceSegment([61, 185, 37, 0, 267, 291, 314, 17, 84, 61]); // Lips outer loop
        drawFaceSegment([33, 160, 158, 133, 153, 144, 33]); // Left eye orbital
        drawFaceSegment([263, 387, 385, 362, 380, 373, 263]); // Right eye orbital

        // Render micro tech targets around pupils
        const leftPupil = faceLandmarks[468] || faceLandmarks[159] || faceLandmarks[33];
        const rightPupil = faceLandmarks[473] || faceLandmarks[386] || faceLandmarks[263];
        if (leftPupil) {
          const lp = getPos(leftPupil);
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, 4, 0, 2 * Math.PI);
          ctx.strokeStyle = 'cyan';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (rightPupil) {
          const rp = getPos(rightPupil);
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, 4, 0, 2 * Math.PI);
          ctx.strokeStyle = 'cyan';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // 4. Draw Face Locking HUD overlay properly mirrored
      const nose = (faceLandmarks && faceLandmarks[1]) || landmarks[0];
      const leftEar = (faceLandmarks && faceLandmarks[234]) || landmarks[7];
      const rightEar = (faceLandmarks && faceLandmarks[454]) || landmarks[8];

      if (nose && (!nose.visibility || nose.visibility > 0.01)) {
        let facePX = (1 - nose.x) * width;
        let facePY = nose.y * height;
        let faceRadius = width * 0.08;

        if (leftEar && rightEar && (!leftEar.visibility || leftEar.visibility > 0.01) && (!rightEar.visibility || rightEar.visibility > 0.01)) {
          facePX = (((1 - leftEar.x) + (1 - rightEar.x)) / 2) * width;
          const earDist = Math.sqrt(Math.pow(leftEar.x - rightEar.x, 2) + Math.pow(leftEar.y - rightEar.y, 2));
          faceRadius = (earDist / 2) * width * 1.35;
          facePY = (((leftEar.y + rightEar.y) / 2) * height) + (faceRadius * 0.12);
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(facePX, facePY, faceRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = perfectFormColor;
        ctx.lineWidth = 1.5;
        const tickLen = 6;
        
        ctx.beginPath();
        ctx.moveTo(facePX, facePY - faceRadius - 3);
        ctx.lineTo(facePX, facePY - faceRadius - 3 - tickLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(facePX, facePY + faceRadius + 3);
        ctx.lineTo(facePX, facePY + faceRadius + 3 + tickLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(facePX - faceRadius - 3, facePY);
        ctx.lineTo(facePX - faceRadius - 3 - tickLen, facePY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(facePX + faceRadius + 3, facePY);
        ctx.lineTo(facePX + faceRadius + 3 + tickLen, facePY);
        ctx.stroke();

        const bWidth = faceRadius * 0.95;
        const bHeight = faceRadius * 1.05;
        const bracketSize = Math.max(12, faceRadius * 0.25);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';

        ctx.beginPath();
        ctx.moveTo(facePX - bWidth + bracketSize, facePY - bHeight);
        ctx.lineTo(facePX - bWidth, facePY - bHeight);
        ctx.lineTo(facePX - bWidth, facePY - bHeight + bracketSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(facePX + bWidth - bracketSize, facePY - bHeight);
        ctx.lineTo(facePX + bWidth, facePY - bHeight);
        ctx.lineTo(facePX + bWidth, facePY - bHeight + bracketSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(facePX - bWidth + bracketSize, facePY + bHeight);
        ctx.lineTo(facePX - bWidth, facePY + bHeight);
        ctx.lineTo(facePX - bWidth, facePY + bHeight - bracketSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(facePX + bWidth - bracketSize, facePY + bHeight);
        ctx.lineTo(facePX + bWidth, facePY + bHeight);
        ctx.lineTo(facePX + bWidth, facePY + bHeight - bracketSize);
        ctx.stroke();

        ctx.font = '700 8px monospace';
        ctx.fillStyle = 'rgba(168, 85, 247, 0.95)';
        ctx.fillText('FACE_LOCK', facePX - bWidth + 2, facePY - bHeight - 5);
        ctx.restore();
      }

      // Draw Joint values & floating metric flags
      const drawJoint = (id: number, labelText?: string) => {
        const pt = landmarks[id];
        if (!pt || (pt.visibility !== undefined && pt.visibility < 0.01)) return;
        const coord = getPos(pt);

        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        if (labelText) {
          ctx.font = '700 9px monospace';
          const textWidth = ctx.measureText(labelText).width;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.beginPath();
          ctx.roundRect(coord.x + 12, coord.y - 12, textWidth + 14, 22, 6);
          ctx.fill();

          ctx.strokeStyle = perfectFormColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(coord.x + 12, coord.y - 12, textWidth + 14, 22, 6);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.fillText(labelText, coord.x + 19, coord.y + 3);
        }
      };

      // Draw raw anchor node dots on general joints regardless of active highlighting to look rich
      const majorJointIDs = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      majorJointIDs.forEach((id) => {
        const pt = landmarks[id];
        if (!pt || (pt.visibility !== undefined && pt.visibility < 0.05)) return;
        const coord = getPos(pt);
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 3, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = perfectFormColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      if (exercise === 'Squats') {
        drawJoint(25, `${leftKneeAngle}°`);
        drawJoint(26, `${rightKneeAngle}°`);
      } else if (exercise === 'Bicep Curls' || exercise === 'Overhead Press' || exercise === 'Pushups') {
        drawJoint(13, `${leftElbowAngle}°`);
        drawJoint(14, `${rightElbowAngle}°`);
      }
    }
  }, [landmarks, exercise, perfectFormColor, faceLandmarks]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Visual Workspace controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl w-full gap-3 shadow-md">
        <div className="flex items-center gap-2.5 px-0.5">
          <div className="p-2 bg-sky-500/10 border border-sky-500/15 text-sky-400 rounded-xl">
            <Camera className="w-4.5 h-4.5" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-100 font-sans uppercase tracking-wider block">
              POSTURE VIEWPORT
            </span>
            <span className="text-[10px] text-slate-400 font-sans block mt-0.5 leading-none">
              Live skeletal tracking & postural vector overlay.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Tracking Colors picker (Addresses user requests: "is there a way for you to change the colors?") */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-850 shadow-inner">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider px-1">
              Color Preset:
            </span>
            <div className="flex gap-1.5">
              {NEON_COLORS.map((nc) => (
                <button
                  key={nc.name}
                  type="button"
                  onClick={() => setPerfectFormColor(nc.joint)}
                  className={`w-4 h-4 rounded-full border hover:scale-110 active:scale-95 transition-all cursor-pointer ${perfectFormColor === nc.joint ? 'border-white ring-2 ring-sky-500/40' : 'border-transparent'}`}
                  style={{ backgroundColor: nc.value }}
                  title={`Skeletal Sync Tone: ${nc.name}`}
                />
              ))}
            </div>
          </div>

          <button
            id="btn_view_live_cam"
            type="button"
            onClick={() => {
              if (isSimulated) {
                setIsSimulated(false);
              } else {
                startWebcam();
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider cursor-pointer border ${!isSimulated ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md' : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200'}`}
          >
            Camera
          </button>
          
          <button
            id="btn_view_sim"
            type="button"
            onClick={() => {
              stopWebcam();
              setIsSimulated(true);
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all tracking-wider cursor-pointer border ${isSimulated ? 'bg-sky-500 text-slate-950 border-sky-450 font-black shadow-md' : 'bg-slate-950 text-slate-400 border-slate-850 hover:text-slate-200'}`}
          >
            Simulator
          </button>
        </div>
      </div>

      {/* Camera and skeletal overlay target viewport */}
      <div className="relative w-full aspect-[4/3] rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Loading overlay spinner */}
        {loadingModel && (
          <div className="absolute inset-0 bg-slate-950/90 z-30 flex flex-col items-center justify-center text-center p-4">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mb-3" />
            <p className="text-xs font-black uppercase text-slate-200 tracking-wider">INITIALIZING TRACKING SERVICES</p>
            <p className="text-[10px] text-slate-500 mt-1">Spinning up neural face/body landmark coordinate matrices...</p>
          </div>
        )}

        {/* Tech Grid mesh under video/background for design consistency */}
        <div className="absolute inset-0 bg-radial-mesh opacity-30 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(rgba(14, 165, 233, 0.15) 1.5px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        {/* Video stream element (Mirrored to keep user comfortable) */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${isSimulated ? 'hidden' : 'block'}`}
          playsInline
          muted
          autoPlay
        />

        {/* 2D Skeletal JS Canvas overlay (Un-mirrored in CSS so text prints normally!) */}
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="absolute inset-0 w-full h-full z-10 touch-none object-cover"
        />

        {/* Mode Indicators Overlay HUD flag */}
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-lg border ${isSimulated ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSimulated ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400 animate-ping'}`} />
            {isSimulated ? 'Posture Simulator' : 'Self Camera view'}
          </span>
        </div>

        {/* Webcam access permission banner block */}
        {permissionError && (
          <div className="absolute bottom-4 left-4 right-4 z-20 p-3 rounded-xl bg-red-950/95 backdrop-blur-md border border-red-850/80 text-red-100 text-[10px] flex gap-2.5 items-start shadow-xl">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-bold text-red-300 uppercase tracking-wide">Camera Configuration Notice</p>
              <p className="opacity-90 leading-relaxed mt-0.5">{permissionError}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
