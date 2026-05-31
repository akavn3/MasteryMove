import { useEffect, useRef, useState } from 'react';
import { Landmark, ExerciseType } from '../types';
import { calculateAngle, getSimulatedLandmarks } from '../utils';
import { Camera, AlertCircle, RefreshCw, Zap, Play, Square } from 'lucide-react';

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
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Sync latest prop references using React refs to bypass stale event handler closure capturing
  const onPoseResultsRef = useRef(onPoseResults);
  useEffect(() => {
    onPoseResultsRef.current = onPoseResults;
  }, [onPoseResults]);

  const isSimulatedRef = useRef(isSimulated);
  useEffect(() => {
    isSimulatedRef.current = isSimulated;
  }, [isSimulated]);
  
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

  // 1. Simulator animation loop (runs ALWAYS to show perfect guide model)
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

    requestRef.current = requestAnimationFrame(animateSimulation);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      prevTimeRef.current = null;
    };
  }, [exercise]);

  const generateSimulatedHand = (
    wrist: Landmark,
    isLeft: boolean,
    motionFactor: number,
    scale: number,
    asymmetry: number
  ): Landmark[] => {
    const hand: Landmark[] = [];
    hand.push({ x: wrist.x, y: wrist.y, z: wrist.z || 0 });

    const pinchFactor = isLeft ? motionFactor : motionFactor * (1 - asymmetry * 0.4);

    if (isLeft) {
      // 1. Thumb (Tip is index 4)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x + scale * (0.015 - pinchFactor * 0.025) * (f / 4),
          y: wrist.y - scale * (0.025 + pinchFactor * 0.035) * (f / 4),
          z: (wrist.z || 0) + 0.01
        });
      }
      // 2. Index (Tip is index 8)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x - scale * (0.025 - pinchFactor * 0.02) * (f / 4),
          y: wrist.y - scale * (0.06 - pinchFactor * 0.025) * (f / 4),
          z: (wrist.z || 0) - 0.02
        });
      }
      // 3. Middle (Tip is index 12)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x - scale * 0.01 * (f / 4),
          y: wrist.y - scale * 0.075 * (f / 4),
          z: (wrist.z || 0) - 0.03
        });
      }
      // 4. Ring (Tip is index 16)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x + scale * 0.005 * (f / 4),
          y: wrist.y - scale * 0.07 * (f / 4),
          z: (wrist.z || 0) - 0.03
        });
      }
      // 5. Pinky (Tip is index 20)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x + scale * 0.022 * (f / 4),
          y: wrist.y - scale * 0.058 * (f / 4),
          z: (wrist.z || 0) - 0.02
        });
      }
    } else {
      // Right Hand
      // 1. Thumb (Tip is index 4)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x - scale * (0.015 - pinchFactor * 0.025) * (f / 4),
          y: wrist.y - scale * (0.025 + pinchFactor * 0.035) * (f / 4),
          z: (wrist.z || 0) + 0.01
        });
      }
      // 2. Index (Tip is index 8)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x + scale * (0.025 - pinchFactor * 0.02) * (f / 4),
          y: wrist.y - scale * (0.06 - pinchFactor * 0.025) * (f / 4),
          z: (wrist.z || 0) - 0.02
        });
      }
      // 3. Middle (Tip is index 12)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x + scale * 0.01 * (f / 4),
          y: wrist.y - scale * 0.075 * (f / 4),
          z: (wrist.z || 0) - 0.03
        });
      }
      // 4. Ring (Tip is index 16)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x - scale * 0.005 * (f / 4),
          y: wrist.y - scale * 0.07 * (f / 4),
          z: (wrist.z || 0) - 0.03
        });
      }
      // 5. Pinky (Tip is index 20)
      for (let f = 1; f <= 4; f++) {
        hand.push({
          x: wrist.x - scale * 0.022 * (f / 4),
          y: wrist.y - scale * 0.058 * (f / 4),
          z: (wrist.z || 0) - 0.02
        });
      }
    }
    return hand;
  };

  // 2. Feed simulated landmarks to parent ONLY IF webcam is inactive
  useEffect(() => {
    if (isSimulated) {
      const motionFactor = 0.5 - 0.5 * Math.cos(simProgress * Math.PI * 2);
      
      // Override any inherited form errors so the simulator always demonstrates perfect, normal human mechanics without wobbling or defects
      const perfectForm = { elbowFlare: 0, poorDepth: 0, asymmetry: 0, forwardLean: 0 };
      const simPoints = getSimulatedLandmarks(exercise, motionFactor, perfectForm);
      setLandmarks(simPoints);
      if (onPoseResults) onPoseResults(simPoints);

      // Face mesh calculations
      const nosePoint = simPoints[0] || { x: 0.5, y: 0.17, z: 0 };
      const simulatedFace: Landmark[] = [];
      const tiltOffset = 0; // No wobbling

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

      // Left hand
      const isPinch = exercise === 'Finger Pinch Drill';
      const scale = isPinch ? 4.5 : 1.0;
      const leftWrist = isPinch 
        ? { x: 0.30, y: 0.75, z: -0.1 } 
        : (simPoints[15] || { x: 0.42, y: 0.58, z: -0.1 });

      const simLeftHand = generateSimulatedHand(leftWrist, true, motionFactor, scale, 0);
      setLeftHandLandmarks(simLeftHand);

      // Right hand
      const rightWrist = isPinch 
        ? { x: 0.70, y: 0.75, z: 0.1 } 
        : (simPoints[16] || { x: 0.58, y: 0.58, z: 0.1 });

      const simRightHand = generateSimulatedHand(rightWrist, false, motionFactor, scale, 0);
      setRightHandLandmarks(simRightHand);
    }
  }, [isSimulated, simProgress, exercise]);

  const stopWebcam = () => {
    activeDetectionRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsSimulated(true);
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
      setPermissionError("Access to webcam denied. Please enable webcam permissions in your browser.");
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
        if (isSimulatedRef.current) return;

        let points: Landmark[] = [];
        if (results.poseLandmarks) {
          points = results.poseLandmarks.map((pt: any) => ({
            x: pt.x,
            y: pt.y,
            z: pt.z || 0,
            visibility: pt.visibility !== undefined ? pt.visibility : 0.9
          }));
          setLandmarks(points);
          if (onPoseResultsRef.current) onPoseResultsRef.current(points);
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
      setPermissionError("Could not initialize camera tracking framework. Running simulator instead.");
      setIsSimulated(true);
      setLoadingModel(false);
    }
  };

  const runHolisticDetection = () => {
    const detect = async () => {
      if (!videoRef.current || !activeDetectionRef.current || isSimulatedRef.current) return;

      const now = Date.now();
      if (now - lastRunTimeRef.current >= 40) { // Limit to ~24fps for low processor overhead
        if (!processingRef.current && videoRef.current.readyState >= 2) {
          processingRef.current = true;
          try {
            await holisticInstanceRef.current.send({ image: videoRef.current });
            lastRunTimeRef.current = now;
          } catch (err) {
            console.warn("MediaPipe frame skipped:", err);
          } finally {
            processingRef.current = false;
          }
        }
      }

      if (activeDetectionRef.current && !isSimulated) {
        requestAnimationFrame(detect);
      }
    };

    activeDetectionRef.current = true;
    requestAnimationFrame(detect);
  };

  useEffect(() => {
    if (cameraActive && !isSimulated) {
      runHolisticDetection();
    } else {
      activeDetectionRef.current = false;
    }
  }, [cameraActive, isSimulated]);

  // Clean elements on unmount
  useEffect(() => {
    return () => {
      activeDetectionRef.current = false;
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Universal drawing function that paints a posture snapshot onto a canvas
  const drawSkeletalFrame = (
    canvas: HTMLCanvasElement,
    pts: Landmark[],
    facePts: Landmark[],
    handLPts: Landmark[],
    handRPts: Landmark[],
    themeColor: string,
    isWebcamFeed: boolean,
    customErrors: typeof formErrors
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!pts || pts.length === 0) return;

    const width = canvas.width;
    const height = canvas.height;

    // Correctly mirror coordinate to make user natural, or keep it standard.
    const getPos = (landmark: Landmark) => ({
      x: Math.round((1 - landmark.x) * width),
      y: Math.round(landmark.y * height)
    });

    const getErrorLevel = (value: number): 'perfect' | 'warning' | 'error' => {
      if (value > 0.25) return 'error';
      if (value > 0.10) return 'warning';
      return 'perfect';
    };

    const squatDepthLevel = exercise === 'Squats' ? getErrorLevel(customErrors.poorDepth) : 'perfect';
    const leanLevel = getErrorLevel(customErrors.forwardLean);
    const asymmetryLevel = getErrorLevel(customErrors.asymmetry);
    const elbowFlareLevel = (exercise === 'Bicep Curls' || exercise === 'Pushups' || exercise === 'Overhead Press') 
      ? getErrorLevel(customErrors.elbowFlare) 
      : 'perfect';

    const drawBone = (idA: number, idB: number, errorLevel: 'perfect' | 'warning' | 'error' = 'perfect') => {
      const ptA = pts[idA];
      const ptB = pts[idB];
      if (!ptA || !ptB || (ptA.visibility !== undefined && ptA.visibility < 0.05) || (ptB.visibility !== undefined && ptB.visibility < 0.05)) return;

      const pA = getPos(ptA);
      const pB = getPos(ptB);

      let color = themeColor;
      let shadowBlur = 0;
      
      if (errorLevel === 'error') {
        color = 'rgb(239, 68, 68)';
        shadowBlur = 12;
      } else if (errorLevel === 'warning') {
        color = 'rgb(234, 179, 8)';
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

    if (pts[23] && pts[25] && pts[27]) {
      leftKneeAngle = calculateAngle(pts[23], pts[25], pts[27]);
    }
    if (pts[24] && pts[26] && pts[28]) {
      rightKneeAngle = calculateAngle(pts[24], pts[26], pts[28]);
    }
    if (pts[11] && pts[13] && pts[15]) {
      leftElbowAngle = calculateAngle(pts[11], pts[13], pts[15]);
    }
    if (pts[12] && pts[14] && pts[16]) {
      rightElbowAngle = calculateAngle(pts[12], pts[14], pts[16]);
    }

    if (exercise !== 'Finger Pinch Drill') {
      // Torso Frame
      drawBone(11, 12);
      drawBone(23, 24);
      drawBone(11, 23, leanLevel);
      drawBone(12, 24, leanLevel);

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

      // Feet
      drawBone(27, 29); drawBone(29, 31); drawBone(27, 31);
      drawBone(28, 30); drawBone(30, 32); drawBone(28, 32);

      // Wrists anchor lines
      drawBone(15, 17); drawBone(15, 19); drawBone(15, 21);
      drawBone(16, 18); drawBone(16, 20); drawBone(16, 22);

      if (!facePts || facePts.length === 0) {
        drawBone(0, 1); drawBone(0, 2); drawBone(1, 3); drawBone(2, 4);
        drawBone(0, 5); drawBone(0, 6); drawBone(3, 7); drawBone(4, 8);
      }
    }

    const drawHandBoneLocal = (handPoints: Landmark[], iA: number, iB: number) => {
      if (!handPoints[iA] || !handPoints[iB]) return;
      const p1 = getPos(handPoints[iA]);
      const p2 = getPos(handPoints[iB]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    };

    const renderFingerHandLocal = (handPoints: Landmark[]) => {
      if (!handPoints || handPoints.length === 0) return;
      for (let f = 0; f < 5; f++) {
        const base = f * 4 + 1;
        drawHandBoneLocal(handPoints, 0, base);
        drawHandBoneLocal(handPoints, base, base + 1);
        drawHandBoneLocal(handPoints, base + 1, base + 2);
        drawHandBoneLocal(handPoints, base + 2, base + 3);
      }
      drawHandBoneLocal(handPoints, 5, 9);
      drawHandBoneLocal(handPoints, 9, 13);
      drawHandBoneLocal(handPoints, 13, 17);
      drawHandBoneLocal(handPoints, 0, 5);
      drawHandBoneLocal(handPoints, 0, 17);

      for (let i = 0; i < handPoints.length; i++) {
        const coord = getPos(handPoints[i]);
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    };

    if (handLPts && handLPts.length > 0) renderFingerHandLocal(handLPts);
    if (handRPts && handRPts.length > 0) renderFingerHandLocal(handRPts);

    if (exercise === 'Finger Pinch Drill') {
      if (handLPts && handLPts.length > 8) {
        const thumbTip = handLPts[4];
        const indexTip = handLPts[8];
        if (thumbTip && indexTip) {
          const pThumb = getPos(thumbTip);
          const pIndex = getPos(indexTip);
          ctx.font = '700 9px monospace';
          ctx.fillStyle = themeColor;
          ctx.fillText(`L PINCH`, (pThumb.x + pIndex.x) / 2 + 8, (pThumb.y + pIndex.y) / 2 - 2);

          ctx.beginPath();
          ctx.moveTo(pThumb.x, pThumb.y);
          ctx.lineTo(pIndex.x, pIndex.y);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      if (handRPts && handRPts.length > 8) {
        const thumbTip = handRPts[4];
        const indexTip = handRPts[8];
        if (thumbTip && indexTip) {
          const pThumb = getPos(thumbTip);
          const pIndex = getPos(indexTip);
          ctx.font = '700 9px monospace';
          ctx.fillStyle = themeColor;
          ctx.fillText(`R PINCH`, (pThumb.x + pIndex.x) / 2 + 8, (pThumb.y + pIndex.y) / 2 - 2);

          ctx.beginPath();
          ctx.moveTo(pThumb.x, pThumb.y);
          ctx.lineTo(pIndex.x, pIndex.y);
          ctx.strokeStyle = themeColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    }

    if (exercise !== 'Finger Pinch Drill') {
      if (facePts && facePts.length > 0) {
        ctx.fillStyle = themeColor.replace(/[\d\.]+\)$/, '0.35)');
        for (let i = 0; i < facePts.length; i += 4) { // slightly downsampled
          const pt = facePts[i];
          if (!pt) continue;
          const coord = getPos(pt);
          ctx.beginPath();
          ctx.arc(coord.x, coord.y, 1.0, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      const nose = (facePts && facePts[1]) || pts[0];
      const leftEar = (facePts && facePts[234]) || pts[7];
      const rightEar = (facePts && facePts[454]) || pts[8];

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
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = themeColor;
        ctx.lineWidth = 1.2;
        const tickLen = 5;
        
        ctx.beginPath(); ctx.moveTo(facePX, facePY - faceRadius - 2); ctx.lineTo(facePX, facePY - faceRadius - 2 - tickLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(facePX, facePY + faceRadius + 2); ctx.lineTo(facePX, facePY + faceRadius + 2 + tickLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(facePX - faceRadius - 2, facePY); ctx.lineTo(facePX - faceRadius - 2 - tickLen, facePY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(facePX + faceRadius + 2, facePY); ctx.lineTo(facePX + faceRadius + 2 + tickLen, facePY); ctx.stroke();
        ctx.restore();
      }
    }

    const drawJoint = (id: number, labelText?: string, errorLevel: 'perfect' | 'warning' | 'error' = 'perfect') => {
      const pt = pts[id];
      if (!pt || (pt.visibility !== undefined && pt.visibility < 0.01)) return;
      const coord = getPos(pt);

      let colorCircle = 'rgba(255, 255, 255, 0.2)';
      let colorInner = '#ffffff';
      let strokeColor = themeColor;

      if (errorLevel === 'error') {
        colorCircle = 'rgba(239, 68, 68, 0.45)';
        colorInner = 'rgb(239, 68, 68)';
        strokeColor = 'rgb(239, 68, 68)';
      } else if (errorLevel === 'warning') {
        colorCircle = 'rgba(234, 179, 8, 0.45)';
        colorInner = 'rgb(234, 179, 8)';
        strokeColor = 'rgb(234, 179, 8)';
      }

      ctx.beginPath();
      ctx.arc(coord.x, coord.y, 8.5, 0, 2 * Math.PI);
      ctx.fillStyle = colorCircle;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(coord.x, coord.y, 4.0, 0, 2 * Math.PI);
      ctx.fillStyle = colorInner;
      ctx.fill();

      if (labelText) {
        ctx.font = '700 8.5px monospace';
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(coord.x + 10, coord.y - 10, textWidth + 12, 18, 5);
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.roundRect(coord.x + 10, coord.y - 10, textWidth + 12, 18, 5);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, coord.x + 16, coord.y + 2);
      }
    };

    const majorJointIDs = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    majorJointIDs.forEach((id) => {
      const pt = pts[id];
      if (!pt || (pt.visibility !== undefined && pt.visibility < 0.05)) return;
      const coord = getPos(pt);
      
      let errorLevel: 'perfect' | 'warning' | 'error' = 'perfect';
      if (id === 13 || id === 14) {
        errorLevel = (exercise === 'Bicep Curls' || exercise === 'Pushups' || exercise === 'Overhead Press') ? getErrorLevel(customErrors.elbowFlare) : 'perfect';
      } else if (id === 25 || id === 26) {
        errorLevel = (exercise === 'Squats' || exercise === 'Warrior II') ? getErrorLevel(customErrors.poorDepth) : 'perfect';
      } else if (id === 11 || id === 12 || id === 23 || id === 24) {
        errorLevel = getErrorLevel(customErrors.forwardLean);
      }

      let colorInner = '#ffffff';
      let strokeColor = themeColor;
      if (errorLevel === 'error') {
        colorInner = 'rgb(239, 68, 68)';
        strokeColor = 'rgb(239, 68, 68)';
      } else if (errorLevel === 'warning') {
        colorInner = 'rgb(234, 179, 8)';
        strokeColor = 'rgb(234, 179, 8)';
      }

      ctx.beginPath();
      ctx.arc(coord.x, coord.y, 2.8, 0, 2 * Math.PI);
      ctx.fillStyle = colorInner;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    if (exercise === 'Squats') {
      const kneeErr = squatDepthLevel === 'perfect' ? asymmetryLevel : squatDepthLevel;
      drawJoint(25, `${leftKneeAngle}°`, kneeErr);
      drawJoint(26, `${rightKneeAngle}°`, kneeErr);
    } else if (exercise === 'Bicep Curls' || exercise === 'Overhead Press' || exercise === 'Pushups') {
      const armErr = elbowFlareLevel === 'perfect' ? asymmetryLevel : elbowFlareLevel;
      drawJoint(13, `${leftElbowAngle}°`, armErr);
      drawJoint(14, `${rightElbowAngle}°`, armErr);
    }
  };

  // 3. Effect loop to draw LIVE camera feed on liveCanvasRef
  useEffect(() => {
    const canvas = liveCanvasRef.current;
    if (!canvas) return;
    
    if (!cameraActive) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    drawSkeletalFrame(
      canvas,
      landmarks,
      faceLandmarks,
      leftHandLandmarks,
      rightHandLandmarks,
      perfectFormColor,
      true,
      formErrors
    );
  }, [landmarks, cameraActive, perfectFormColor, faceLandmarks, leftHandLandmarks, rightHandLandmarks]);

  // 4. Effect loop to draw SIMULATION guide feed on simCanvasRef (ALWAYS active & looping)
  useEffect(() => {
    const canvas = simCanvasRef.current;
    if (!canvas) return;

    const motionFactor = 0.5 - 0.5 * Math.cos(simProgress * Math.PI * 2);
    const perfectForm = { elbowFlare: 0, poorDepth: 0, asymmetry: 0, forwardLean: 0 };
    const simPoints = getSimulatedLandmarks(exercise, motionFactor, perfectForm);

    // Compute face coordinates for simulator
    const nosePoint = simPoints[0] || { x: 0.5, y: 0.17, z: 0 };
    const simulatedFace: Landmark[] = [];
    const tiltOffset = 0; // No wobbling
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
    const finalSimFace = simulatedFace.slice(0, 468);

    // Left hand
    const isPinch = exercise === 'Finger Pinch Drill';
    const scale = isPinch ? 4.5 : 1.0;
    const leftWrist = isPinch 
      ? { x: 0.30, y: 0.75, z: -0.1 } 
      : (simPoints[15] || { x: 0.42, y: 0.58, z: -0.1 });

    const simLeftHand = generateSimulatedHand(leftWrist, true, motionFactor, scale, 0);

    // Right hand
    const rightWrist = isPinch 
      ? { x: 0.70, y: 0.75, z: 0.1 } 
      : (simPoints[16] || { x: 0.58, y: 0.58, z: 0.1 });

    const simRightHand = generateSimulatedHand(rightWrist, false, motionFactor, scale, 0);

    drawSkeletalFrame(
      canvas,
      simPoints,
      finalSimFace,
      simLeftHand,
      simRightHand,
      perfectFormColor,
      false,
      perfectForm
    );
  }, [simProgress, exercise, perfectFormColor]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Visual Workspace controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-2xl w-full gap-3 shadow-md">
        <div className="flex items-center gap-2.5 px-0.5">
          <div className="p-2 bg-sky-500/10 border border-sky-500/15 text-sky-400 rounded-xl">
            <Camera className="w-4.5 h-4.5 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-100 font-sans uppercase tracking-wider block">
              PRACTICE VIEWPORT CENTER
            </span>
            <span className="text-[10px] text-slate-400 font-sans block mt-0.5 leading-none">
              Side-by-side skeletal tracking comparison. Follow the simulator model on the right!
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Tracking Colors picker */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-850 shadow-inner">
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider px-1">
              Skeletal Glow:
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
        </div>
      </div>

      {/* Side-by-Side double camera viewport slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
        
        {/* PANEL A: LIVE PRACTICE CAMERA */}
        <div className="relative w-full aspect-[4/3] rounded-2xl bg-slate-950 border border-slate-850 shadow-2xl overflow-hidden flex flex-col items-center justify-center">
          
          {/* Grid lines layout */}
          <div className="absolute inset-0 bg-radial-mesh opacity-20 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(rgba(34, 197, 94, 0.15) 1.5px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />

          {/* Model Loading layout */}
          {loadingModel && (
            <div className="absolute inset-0 bg-slate-950/90 z-30 flex flex-col items-center justify-center text-center p-4">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
              <p className="text-xs font-black uppercase text-slate-200 tracking-wider">BOOTSTRAPPING CAMERA FEED</p>
              <p className="text-[10px] text-slate-400 mt-1">Spinning up browser neural coordinate matrices...</p>
            </div>
          )}

          {/* If camera is NOT active, show an engaging call to action */}
          {!cameraActive && (
            <div className="text-center p-6 flex flex-col items-center z-20">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-450 mb-3.5">
                <Camera className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold uppercase text-slate-200 tracking-wider">Practice Camera Offline</h4>
              <p className="text-[10px] text-slate-500 max-w-xs mt-1.5 leading-relaxed">
                Unlock real-time alignment scores. Connect your device camera to trace vectors over your joints.
              </p>
              <button
                type="button"
                onClick={startWebcam}
                className="mt-4 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black text-[10px] uppercase tracking-wider px-5 py-2.5 rounded-lg cursor-pointer transition-all shadow-md active:scale-95"
              >
                🎥 Activate Webcam
              </button>
            </div>
          )}

          {/* Actual Video View (mirrored) - always mounted to prevent ref resolution errors */}
          <video
            ref={videoRef}
            className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${cameraActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            playsInline
            muted
            autoPlay
          />

          {/* Skeletal tracking overlay layout (unmirrored canvas layout) */}
          <canvas
            ref={liveCanvasRef}
            width={640}
            height={480}
            className={`absolute inset-0 w-full h-full z-10 touch-none object-cover transition-opacity duration-300 ${cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Connected overlays controls */}
          {cameraActive && (
            <button
              type="button"
              onClick={stopWebcam}
              className="absolute bottom-4 right-4 z-20 bg-red-600/90 hover:bg-red-500 text-white font-extrabold text-[9px] uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-all border border-red-500/30"
            >
              Stop Camera
            </button>
          )}

          {/* Title banner */}
          <div className="absolute top-4 left-4 z-20">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
              <span className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
              Self Webcam Tracker
            </span>
          </div>

          {/* Webcam error block */}
          {permissionError && (
            <div className="absolute bottom-4 left-4 right-4 z-20 p-2 text-[9px] rounded-lg bg-red-950/95 border border-red-850 text-red-300">
              {permissionError}
            </div>
          )}
        </div>

        {/* PANEL B: IDEAL POSTURE SIMULATOR MODEL */}
        <div className="relative w-full aspect-[4/3] rounded-2xl bg-slate-950 border border-slate-850 shadow-2xl overflow-hidden flex flex-col items-center justify-center">
          
          {/* Tech grid mesh background */}
          <div className="absolute inset-0 bg-radial-mesh opacity-20 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(rgba(14, 165, 233, 0.15) 1.5px, transparent 0)',
            backgroundSize: '20px 20px'
          }} />

          {/* Skeletal canvas */}
          <canvas
            ref={simCanvasRef}
            width={640}
            height={480}
            className="absolute inset-0 w-full h-full z-10 touch-none object-cover"
          />

          {/* Title banner */}
          <div className="absolute top-4 left-4 z-20">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-md bg-sky-500/10 text-sky-455 border border-sky-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              Posture Guide Simulator
            </span>
          </div>

          <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
            <span className="text-[8px] font-bold font-mono text-slate-500 uppercase tracking-widest leading-none">
              IDEAL FRAME LOOP
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
