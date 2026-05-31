import { Landmark, ExerciseType } from './types';

// Calculate the 3D joint angle in degrees at vertex B (between points A, B, and C)
export function calculateAngle(A: Landmark, B: Landmark, C: Landmark): number {
  if (!A || !B || !C) return 180;

  // Vector BA
  const v1 = {
    x: A.x - B.x,
    y: A.y - B.y,
    z: A.z - B.z,
  };

  // Vector BC
  const v2 = {
    x: C.x - B.x,
    y: C.y - B.y,
    z: C.z - B.z,
  };

  // Dot product
  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

  // Magnitudes
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  if (mag1 === 0 || mag2 === 0) return 180;

  let cosTheta = dotProduct / (mag1 * mag2);
  // Clamp boundaries to prevent NaN floating calculation shifts
  cosTheta = Math.max(-1, Math.min(1, cosTheta));

  const angleRad = Math.acos(cosTheta);
  return Math.round((angleRad * 180) / Math.PI);
}

// Calculate deviation distance from linearity of a shoulder-hip-ankle postural bar
export function calculateSpineStiffness(shoulder: Landmark, hip: Landmark, ankle: Landmark): number {
  if (!shoulder || !hip || !ankle) return 100;
  // Measures the coordinate alignment. Ideally B lies exactly on line AC.
  // 2D distance from Hip point to the line shoulder-ankle
  const x1 = shoulder.x, y1 = shoulder.y;
  const x2 = ankle.x, y2 = ankle.y;
  const px = hip.x, py = hip.y;

  const numerator = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1);
  const denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

  if (denominator === 0) return 100;
  const dist = numerator / denominator;
  
  // Normalize score: 0.0 distance is 100%, 0.15 normalized width is 0%
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - dist / 0.12))));
  return score;
}

// Generate synthesized landmarks representing exercise loops for simulator mode
export function getSimulatedLandmarks(
  exercise: ExerciseType,
  progress: number, // 0.0 to 1.0 (phase inside the rep loop)
  formErrors: {
    elbowFlare: number; // 0 to 1
    poorDepth: number;  // 0 to 1
    asymmetry: number;  // 0 to 1
    forwardLean: number;// 0 to 1
  }
): Landmark[] {
  // Return an array of 33 landmarks mapping general body skeleton positioning.
  // We initialize with a beautiful, natural standing pose baseline so that all bones (including feet & hands)
  // are beautifully integrated and visible even in isolated modes, solving any unhydrated visual coordinate convergence.
  const landmarks: Landmark[] = Array(33).fill(null).map((_, i) => {
    // Head / Face
    if (i === 0) return { x: 0.5, y: 0.17, z: 0, visibility: 0.99 }; // nose
    if (i === 2) return { x: 0.482, y: 0.156, z: 0, visibility: 0.99 }; // left eye
    if (i === 5) return { x: 0.518, y: 0.156, z: 0, visibility: 0.99 }; // right eye
    if (i === 7) return { x: 0.465, y: 0.177, z: 0, visibility: 0.99 }; // left ear
    if (i === 8) return { x: 0.535, y: 0.177, z: 0, visibility: 0.99 }; // right ear
    if (i === 9) return { x: 0.488, y: 0.191, z: 0, visibility: 0.99 }; // left mouth
    if (i === 10) return { x: 0.512, y: 0.191, z: 0, visibility: 0.99 }; // right mouth

    // Shoulders & Chest
    if (i === 11) return { x: 0.44, y: 0.35, z: -0.05, visibility: 0.98 }; // left shoulder
    if (i === 12) return { x: 0.56, y: 0.35, z: 0.05, visibility: 0.98 }; // right shoulder
    if (i === 13) return { x: 0.40, y: 0.48, z: -0.08, visibility: 0.98 }; // left elbow
    if (i === 14) return { x: 0.60, y: 0.48, z: 0.08, visibility: 0.98 }; // right elbow
    if (i === 15) return { x: 0.42, y: 0.58, z: -0.10, visibility: 0.98 }; // left wrist
    if (i === 16) return { x: 0.58, y: 0.58, z: 0.10, visibility: 0.98 }; // right wrist

    // Hips, Knees, Ankles, Feet
    if (i === 23) return { x: 0.45, y: 0.60, z: -0.05, visibility: 0.98 }; // left hip
    if (i === 24) return { x: 0.55, y: 0.60, z: 0.05, visibility: 0.98 }; // right hip
    if (i === 25) return { x: 0.45, y: 0.72, z: -0.05, visibility: 0.98 }; // left knee
    if (i === 26) return { x: 0.55, y: 0.72, z: 0.05, visibility: 0.98 }; // right knee
    if (i === 27) return { x: 0.45, y: 0.85, z: -0.05, visibility: 0.98 }; // left ankle
    if (i === 28) return { x: 0.55, y: 0.85, z: 0.05, visibility: 0.98 }; // right ankle
    if (i === 29) return { x: 0.44, y: 0.87, z: -0.06, visibility: 0.98 }; // left heel
    if (i === 30) return { x: 0.56, y: 0.87, z: 0.06, visibility: 0.98 }; // right heel
    if (i === 31) return { x: 0.41, y: 0.88, z: -0.08, visibility: 0.98 }; // left foot index (toe)
    if (i === 32) return { x: 0.59, y: 0.88, z: 0.08, visibility: 0.98 }; // right foot index (toe)

    return { x: 0.5, y: 0.5, z: 0, visibility: 0.99 };
  });

  // Fixed Anchor base: Hips can be near center (0.5, 0.5)
  // Hips: 23 (left), 24 (right)
  const hipYBase = 0.5;
  const hipXWidth = 0.1;
  const currentDepthFactor = progress * (1 - formErrors.poorDepth * 0.45); // Limit amplitude if poor depth

  if (exercise === 'Squats') {
    // Squat: hips drift down, knees expand outwards, shoulders lean slightly forward
    const hipY = hipYBase + currentDepthFactor * 0.22;
    const hipXLeft = 0.5 - hipXWidth / 2 - (formErrors.asymmetry * 0.025);
    const hipXRight = 0.5 + hipXWidth / 2 + (formErrors.asymmetry * 0.015);

    landmarks[23] = { x: hipXLeft, y: hipY, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: hipXRight, y: hipY, z: 0.05, visibility: 0.98 };

    // Ankles fixed on ground (at bottom): 27 (left), 28 (right)
    landmarks[27] = { x: 0.44, y: 0.85, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.56, y: 0.85, z: 0.05, visibility: 0.98 };

    // Knees: flex forwards and down. 25 (left), 26 (right)
    // At standing (currentDepthFactor = 0), knees are at y = 0.68
    // At bottom of squat (currentDepthFactor = 1), knees are at y = 0.79 and wider X to support realistic deep flexion
    const kneeY = 0.68 + currentDepthFactor * 0.11;
    const kneeXSpread = currentDepthFactor * 0.06;
    landmarks[25] = { x: 0.42 - kneeXSpread + (formErrors.asymmetry * 0.03), y: kneeY, z: -0.1, visibility: 0.98 };
    landmarks[26] = { x: 0.58 + kneeXSpread, y: kneeY, z: 0.1, visibility: 0.98 };

    // Shoulders: 11 (left), 12 (right). Standing at y = 0.3. Lean alters x position.
    const leanOffset = currentDepthFactor * 0.08 * formErrors.forwardLean;
    const shoulderY = 0.28 + currentDepthFactor * 0.18;
    landmarks[11] = { x: 0.45 - leanOffset, y: shoulderY, z: -0.08, visibility: 0.98 };
    landmarks[12] = { x: 0.55 - leanOffset, y: shoulderY, z: 0.08, visibility: 0.98 };

    // Hands/Wrists resting out in front: 15, 16
    landmarks[15] = { x: 0.40 - leanOffset - 0.05, y: shoulderY + 0.05, z: -0.15, visibility: 0.98 };
    landmarks[16] = { x: 0.60 - leanOffset + 0.05, y: shoulderY + 0.05, z: 0.15, visibility: 0.98 };

    // Elbows: 13, 14
    landmarks[13] = { x: 0.42 - leanOffset - 0.02, y: shoulderY + 0.08, z: -0.12, visibility: 0.98 };
    landmarks[14] = { x: 0.58 - leanOffset + 0.02, y: shoulderY + 0.08, z: 0.12, visibility: 0.98 };

  } else if (exercise === 'Bicep Curls') {
    // Stand rigid. Elbows constant position. Wrists pivot upwards in a circle.
    landmarks[23] = { x: 0.45, y: 0.55, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.55, y: 0.55, z: 0.05, visibility: 0.98 };
    landmarks[27] = { x: 0.45, y: 0.85, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.55, y: 0.85, z: 0.05, visibility: 0.98 };
    landmarks[25] = { x: 0.45, y: 0.70, z: -0.05, visibility: 0.98 };
    landmarks[26] = { x: 0.55, y: 0.70, z: 0.05, visibility: 0.98 };

    // Shoulders locked: 11, 12
    landmarks[11] = { x: 0.44, y: 0.32, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.56, y: 0.32, z: 0.05, visibility: 0.98 };

    // Elbows: Pinned. Left elbow flares outwards on slider. 13 (left), 14 (right)
    const leftElbowFlareX = formErrors.elbowFlare * 0.06;
    const rightElbowFlareX = formErrors.elbowFlare * 0.03; // slightly asymmetrical
    landmarks[13] = { x: 0.42 - leftElbowFlareX, y: 0.45, z: -0.08, visibility: 0.98 };
    landmarks[14] = { x: 0.58 + rightElbowFlareX, y: 0.45, z: 0.08, visibility: 0.98 };

    // Wrists (curl phase): 15, 16.
    // Standing at full extension (progress = 0) wrist is at y = 0.58
    // Full contraction (progress = 1) wrist swings to y = 0.35 and moves towards shoulder
    const leftCurlFact = progress * (1 - formErrors.asymmetry * 0.3); // Left moves slower on asymmetry
    const rightCurlFact = progress;

    // Radius of curl is ~0.15 coordinate units
    const leftAngle = -Math.PI / 2 + leftCurlFact * Math.PI * 0.7; // swings up
    const rightAngle = -Math.PI / 2 + rightCurlFact * Math.PI * 0.7;

    landmarks[15] = {
      x: landmarks[13].x + 0.12 * Math.cos(leftAngle),
      y: landmarks[13].y - 0.12 * Math.sin(leftAngle),
      z: -0.15,
      visibility: 0.98
    };
    landmarks[16] = {
      x: landmarks[14].x - 0.12 * Math.cos(rightAngle),
      y: landmarks[14].y - 0.12 * Math.sin(rightAngle),
      z: 0.15,
      visibility: 0.98
    };

  } else if (exercise === 'Overhead Press') {
    // Shoulders locked. Wrists travel vertically from shoulders (y=0.42) to full lock overhead (y=0.12)
    landmarks[23] = { x: 0.45, y: 0.55, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.55, y: 0.55, z: 0.05, visibility: 0.98 };
    landmarks[27] = { x: 0.45, y: 0.85, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.55, y: 0.85, z: 0.05, visibility: 0.98 };

    landmarks[11] = { x: 0.44, y: 0.35, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.56, y: 0.35, z: 0.05, visibility: 0.98 };

    const leftSpeed = progress * (1 - formErrors.asymmetry * 0.28);
    const rightSpeed = progress;

    // Wrists travel up
    const leftWristY = 0.36 - leftSpeed * 0.22;
    const rightWristY = 0.36 - rightSpeed * 0.22;
    // X distance pinches slightly outwards as they push up
    const leftWristX = 0.42 - leftSpeed * 0.02;
    const rightWristX = 0.58 + rightSpeed * 0.02;

    landmarks[15] = { x: leftWristX, y: leftWristY, z: -0.1, visibility: 0.98 };
    landmarks[16] = { x: rightWristX, y: rightWristY, z: 0.1, visibility: 0.98 };

    // Elbows: fold down then push wide. 13, 14
    // Flare pushes elbow joint wide
    const leftElbowFlare = formErrors.elbowFlare * 0.05;
    const leftElbowY = 0.43 - leftSpeed * 0.08;
    const leftElbowX = 0.40 - (1 - leftSpeed) * 0.04 - leftElbowFlare;
    landmarks[13] = { x: leftElbowX, y: leftElbowY, z: -0.1, visibility: 0.98 };

    const rightElbowY = 0.43 - rightSpeed * 0.08;
    const rightElbowX = 0.60 + (1 - rightSpeed) * 0.04 + leftElbowFlare;
    landmarks[14] = { x: rightElbowX, y: rightElbowY, z: 0.1, visibility: 0.98 };

  } else if (exercise === 'Pushups') {
    // Horizontal alignment setup (scaled visual model)
    // Left/Right Shoulder: (0.35, 0.65)
    // Hips: (0.55, hipY)
    // Ankles/Feet: (0.75, 0.70) pivots
    // In horizontal mode, height of body goes down
    const pushYOffset = currentDepthFactor * 0.12;
    
    // Core stiffness error is represented by hips sagging downwards faster than the shoulder line
    const coreSag = formErrors.forwardLean * currentDepthFactor * 0.07;

    landmarks[11] = { x: 0.35, y: 0.55 + pushYOffset, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.35, y: 0.55 + pushYOffset, z: 0.05, visibility: 0.98 };

    landmarks[23] = { x: 0.55, y: 0.60 + pushYOffset + coreSag, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.55, y: 0.60 + pushYOffset + coreSag, z: 0.05, visibility: 0.98 };

    // Feet fixed
    landmarks[27] = { x: 0.78, y: 0.65, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.78, y: 0.65, z: 0.05, visibility: 0.98 };

    landmarks[25] = { x: 0.66, y: 0.625 + pushYOffset / 2 + coreSag / 2, z: -0.05, visibility: 0.98 };
    landmarks[26] = { x: 0.66, y: 0.625 + pushYOffset / 2 + coreSag / 2, z: 0.05, visibility: 0.98 };

    // Hands fixed on ground (at bottom)
    landmarks[15] = { x: 0.35, y: 0.70, z: -0.1, visibility: 0.98 };
    landmarks[16] = { x: 0.35, y: 0.70, z: 0.1, visibility: 0.98 };

    // Elbows: bend backward and outwards. Left elbow flare is prominent.
    const elbowFlareOut = formErrors.elbowFlare * 0.07;
    landmarks[13] = { x: 0.32 + pushYOffset * 0.1, y: 0.62 + pushYOffset * 0.3 - (formErrors.asymmetry * 0.02) + elbowFlareOut, z: -0.15, visibility: 0.98 };
    landmarks[14] = { x: 0.32 + pushYOffset * 0.1, y: 0.62 + pushYOffset * 0.25 + elbowFlareOut, z: 0.15, visibility: 0.98 };
  } else if (exercise === 'Warrior II') {
    // Left leg straight, right leg deeply bent with hip shifted.
    // Arms extended straight out to the sides (180 degrees).
    const lFactor = progress * (1 - formErrors.poorDepth * 0.35);

    // Hips shift slightly sideways
    const leftHipX = 0.42 - lFactor * 0.04;
    const rightHipX = 0.54 - lFactor * 0.04;
    landmarks[23] = { x: leftHipX, y: 0.55, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: rightHipX, y: 0.55, z: 0.05, visibility: 0.98 };

    // Left leg (straight back leg)
    landmarks[27] = { x: 0.30, y: 0.85, z: -0.05, visibility: 0.98 }; // Left ankle
    landmarks[25] = { x: 0.36, y: 0.70, z: -0.05, visibility: 0.98 }; // Left knee

    // Right leg (bent front leg)
    const rightAnkleX = 0.72;
    landmarks[28] = { x: rightAnkleX, y: 0.85, z: 0.05, visibility: 0.98 }; // Right ankle
    // Bent knee shifts forward and down to achieve a deep lunge angle (<115)
    const rightKneeX = 0.64 + lFactor * 0.11;
    const rightKneeY = 0.70 + lFactor * 0.12;
    landmarks[26] = { x: rightKneeX, y: rightKneeY, z: 0.05, visibility: 0.98 }; // Right knee

    // Shoulders
    landmarks[11] = { x: 0.43, y: 0.32, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.57, y: 0.32, z: 0.05, visibility: 0.98 };

    // Left arm extended out left side
    // If asymmetry or elbow flare is high, arms are tilted or sag
    const leftArmSag = formErrors.asymmetry * 0.08 + formErrors.elbowFlare * 0.05;
    landmarks[13] = { x: 0.33, y: 0.32 + leftArmSag, z: -0.08, visibility: 0.98 }; // Left elbow
    landmarks[15] = { x: 0.23, y: 0.32 + leftArmSag * 1.5, z: -0.1, visibility: 0.98 }; // Left wrist

    // Right arm extended out right side
    const rightArmSag = formErrors.elbowFlare * 0.08;
    landmarks[14] = { x: 0.67, y: 0.32 + rightArmSag, z: 0.08, visibility: 0.98 }; // Right elbow
    landmarks[16] = { x: 0.77, y: 0.32 + rightArmSag * 1.5, z: 0.1, visibility: 0.98 }; // Right wrist

  } else if (exercise === 'Tree Pose') {
    // Balance pose. Hands joined above head in Anjali Mudra. One leg bent and placed on thigh.
    const treeFactor = progress * (1 - formErrors.poorDepth * 0.3);

    // Left and right hips
    landmarks[23] = { x: 0.46, y: 0.54, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.54, y: 0.54, z: 0.05, visibility: 0.98 };

    // Right Leg (supporting leg, straight)
    landmarks[28] = { x: 0.54, y: 0.85, z: 0.05, visibility: 0.98 }; // Right ankle
    landmarks[26] = { x: 0.54 - (formErrors.asymmetry * 0.02), y: 0.70, z: 0.05, visibility: 0.98 }; // Right knee

    // Left Leg (bent, knee opening outwards)
    const kneeY = 0.70 - treeFactor * 0.08;
    const kneeX = 0.44 - treeFactor * 0.12; 
    const footY = 0.72 - treeFactor * 0.12;
    landmarks[25] = { x: kneeX, y: kneeY, z: -0.05, visibility: 0.98 }; // Left knee
    landmarks[27] = { x: 0.52, y: footY, z: -0.05, visibility: 0.98 }; // Left ankle (placed on thigh)

    // Shoulders
    landmarks[11] = { x: 0.45, y: 0.34, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.55, y: 0.34, z: 0.05, visibility: 0.98 };

    // Hands raised high, joining together at top center.
    const handDisplacementX = formErrors.asymmetry * 0.08;
    const handsHeightScale = treeFactor * 0.22;
    
    // Left Arm
    landmarks[13] = { x: 0.43 - handDisplacementX, y: 0.24 - handsHeightScale * 0.4, z: -0.08, visibility: 0.98 }; // Left elbow
    landmarks[15] = { x: 0.49 - handDisplacementX, y: 0.14 - handsHeightScale * 0.8, z: -0.05, visibility: 0.98 }; // Left wrist

    // Right Arm
    landmarks[14] = { x: 0.57 - handDisplacementX, y: 0.24 - handsHeightScale * 0.4, z: 0.08, visibility: 0.98 }; // Right elbow
    landmarks[16] = { x: 0.51 - handDisplacementX, y: 0.14 - handsHeightScale * 0.8, z: 0.05, visibility: 0.98 }; // Right wrist

  } else if (exercise === 'Downward Dog') {
    // Inverted V. Hips peak high. Arms and legs straight.
    const lFactor = progress * (1 - formErrors.poorDepth * 0.3);

    // Peak hips (inverted V apex)
    const hipY = 0.55 - lFactor * 0.18;
    landmarks[23] = { x: 0.50, y: hipY, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.52, y: hipY, z: 0.05, visibility: 0.98 };

    // Hands on ground
    landmarks[15] = { x: 0.32, y: 0.82, z: -0.1, visibility: 0.98 }; // Left wrist
    landmarks[16] = { x: 0.32, y: 0.82, z: 0.1, visibility: 0.98 };  // Right wrist

    // Feet/Ankles on ground
    landmarks[27] = { x: 0.70, y: 0.82, z: -0.1, visibility: 0.98 }; // Left ankle
    landmarks[28] = { x: 0.72, y: 0.82, z: 0.1, visibility: 0.98 };  // Right ankle

    // Knees: straight unless poorDepth or asymmetry is high
    const kneeBend = formErrors.poorDepth * 0.06;
    landmarks[25] = { x: 0.60, y: 0.685 + kneeBend, z: -0.08, visibility: 0.98 }; // Left knee
    landmarks[26] = { x: 0.62, y: 0.685 + kneeBend, z: 0.08, visibility: 0.98 }; // Right knee

    // Shoulders on line from wrist to hips
    const shoulderY = 0.55 + (1 - lFactor) * 0.1;
    landmarks[11] = { x: 0.40, y: shoulderY, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.41, y: shoulderY, z: 0.05, visibility: 0.98 };

    // Elbows: straight unless elbowFlare is high
    const elbowBend = formErrors.elbowFlare * 0.05;
    landmarks[13] = { x: 0.36, y: 0.685 + elbowBend, z: -0.08, visibility: 0.98 };
    landmarks[14] = { x: 0.36, y: 0.685 + elbowBend, z: 0.08, visibility: 0.98 };

  } else if (exercise === 'Cobra Pose') {
    // Body flat on floor, chest and head lifted back.
    const liftFactor = progress * (1 - formErrors.poorDepth * 0.4);

    // Hips on the ground
    landmarks[23] = { x: 0.52, y: 0.78, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.52, y: 0.80, z: 0.05, visibility: 0.98 };

    // Ankles/Feet extended backward
    landmarks[27] = { x: 0.75, y: 0.82, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.75, y: 0.83, z: 0.05, visibility: 0.98 };

    // Knees resting
    landmarks[25] = { x: 0.64, y: 0.80, z: -0.05, visibility: 0.98 };
    landmarks[26] = { x: 0.64, y: 0.81, z: 0.05, visibility: 0.98 };

    // Hands resting on ground to push chest up
    landmarks[15] = { x: 0.42, y: 0.76, z: -0.1, visibility: 0.98 };
    landmarks[16] = { x: 0.42, y: 0.76, z: 0.1, visibility: 0.98 };

    // Shoulders lifted up by spine arch
    const slouch = formErrors.forwardLean * 0.09;
    const shoulderY = 0.68 - liftFactor * 0.15 + slouch;
    landmarks[11] = { x: 0.43, y: shoulderY, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.43, y: shoulderY + 0.01, z: 0.05, visibility: 0.98 };

    // Elbows support load
    landmarks[13] = { x: 0.39, y: 0.73 + slouch * 0.5, z: -0.08, visibility: 0.98 };
    landmarks[14] = { x: 0.39, y: 0.735 + slouch * 0.5, z: 0.08, visibility: 0.98 };
  } else if (exercise === 'Finger Pinch Drill') {
    // Standing pose, arms lifted front, ready to pinch
    landmarks[23] = { x: 0.45, y: 0.60, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.55, y: 0.60, z: 0.05, visibility: 0.98 };
    landmarks[27] = { x: 0.45, y: 0.85, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.55, y: 0.85, z: 0.05, visibility: 0.98 };
    landmarks[25] = { x: 0.45, y: 0.72, z: -0.05, visibility: 0.98 };
    landmarks[26] = { x: 0.55, y: 0.72, z: 0.05, visibility: 0.98 };

    // Shoulders locked
    landmarks[11] = { x: 0.44, y: 0.35, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.56, y: 0.35, z: 0.05, visibility: 0.98 };

    // Elbows bent in front of chest
    landmarks[13] = { x: 0.40, y: 0.46, z: -0.08, visibility: 0.98 };
    landmarks[14] = { x: 0.60, y: 0.46, z: 0.08, visibility: 0.98 };

    // Wrists facing palm forward close to each other
    landmarks[15] = { x: 0.43, y: 0.38, z: -0.12, visibility: 0.98 };
    landmarks[16] = { x: 0.57, y: 0.38, z: 0.12, visibility: 0.98 };
  } else if (exercise === 'Facial Mobility') {
    // Normal standing, arms bent/resting
    landmarks[23] = { x: 0.45, y: 0.60, z: -0.05, visibility: 0.98 };
    landmarks[24] = { x: 0.55, y: 0.60, z: 0.05, visibility: 0.98 };
    landmarks[27] = { x: 0.45, y: 0.85, z: -0.05, visibility: 0.98 };
    landmarks[28] = { x: 0.55, y: 0.85, z: 0.05, visibility: 0.98 };
    landmarks[25] = { x: 0.45, y: 0.72, z: -0.05, visibility: 0.98 };
    landmarks[26] = { x: 0.55, y: 0.72, z: 0.05, visibility: 0.98 };

    landmarks[11] = { x: 0.44, y: 0.35, z: -0.05, visibility: 0.98 };
    landmarks[12] = { x: 0.56, y: 0.35, z: 0.05, visibility: 0.98 };
    landmarks[13] = { x: 0.40, y: 0.48, z: -0.08, visibility: 0.98 };
    landmarks[14] = { x: 0.60, y: 0.48, z: 0.08, visibility: 0.98 };
    landmarks[15] = { x: 0.43, y: 0.56, z: -0.1, visibility: 0.98 };
    landmarks[16] = { x: 0.57, y: 0.56, z: 0.1, visibility: 0.98 };
  }

  // Hydrate simulated Face points dynamically mapped relative to shoulder line.
  // ALWAYS run this with high fidelity dynamic movement (eyebrow lift, head tilt, mouth opening) 
  // so the face is beautifully animated in all modes, including Squats and Bicep Curls!
  const sMidX = (landmarks[11].x + landmarks[12].x) / 2;
  const sMidY = (landmarks[11].y + landmarks[12].y) / 2;
  const headSize = 0.07;

  // We simulate eyebrow raise / eye wink or mouth opening
  // Eyebrows / eyes (2, 5) move up by liftFactor
  const leftLiftFactor = currentDepthFactor * 0.015;
  const rightLiftFactor = currentDepthFactor * 0.015 * (1 - formErrors.asymmetry * 0.65);

  // Head tilt from forwardLean (neck alignment)
  const headTilt = formErrors.forwardLean * 0.02 * Math.sin(Date.now() / 1500);

  landmarks[0]  = { x: sMidX + headTilt, y: sMidY - headSize * 1.1, z: 0, visibility: 0.99 }; // nose
  landmarks[2]  = { x: sMidX - 0.018 + headTilt, y: sMidY - headSize * 1.3 - leftLiftFactor, z: 0, visibility: 0.99 }; // left eye
  landmarks[5]  = { x: sMidX + 0.018 + headTilt, y: sMidY - headSize * 1.3 - rightLiftFactor, z: 0, visibility: 0.99 }; // right eye
  landmarks[7]  = { x: sMidX - 0.035 + headTilt, y: sMidY - headSize * 1.0, z: 0, visibility: 0.99 }; // left ear
  landmarks[8]  = { x: sMidX + 0.035 + headTilt, y: sMidY - headSize * 1.0, z: 0, visibility: 0.99 }; // right ear
  
  // Mouth open: expand Y distance
  const mouthYExp = currentDepthFactor * 0.012;
  // Mouth asymmetry
  const leftMouthYOffset = formErrors.asymmetry * 0.008;

  landmarks[9]  = { x: sMidX - 0.012 + headTilt, y: sMidY - headSize * 0.8 + mouthYExp + leftMouthYOffset, z: 0, visibility: 0.99 }; // left mouth
  landmarks[10] = { x: sMidX + 0.012 + headTilt, y: sMidY - headSize * 0.8 + mouthYExp, z: 0, visibility: 0.99 }; // right mouth


  // Hydrate simulated Hand fingers mapped dynamically relative to wrists.
  // ALWAYS run the finger pinch articulation dynamically across ALL modes (e.g. Squatting mode also pinches hand fingers)
  // so the entire multi-sensor simulation feels alive and integrated!
  const lwRef = landmarks[15];
  const rwRef = landmarks[16];
  if (lwRef && rwRef) {
    // Left hand index moves closer to thumb
    const leftPinchFactor = currentDepthFactor; // 0 (open) to 1 (touching)
    const rightPinchFactor = currentDepthFactor * (1 - formErrors.asymmetry * 0.4); // right pinched less/lagging if asymmetrical

    // Normal gap is ~0.04 in x/y. Let's make index-thumb move closer
    const leftIndexX = lwRef.x - 0.02 + leftPinchFactor * 0.015;
    const leftIndexY = lwRef.y - 0.06 + leftPinchFactor * 0.015;
    const leftThumbX = lwRef.x + 0.01 - leftPinchFactor * 0.015;
    const leftThumbY = lwRef.y - 0.025 - leftPinchFactor * 0.02;

    landmarks[17] = { x: lwRef.x - 0.035, y: lwRef.y - 0.01, z: -0.15, visibility: 0.99 }; // left pinky
    landmarks[19] = { x: leftIndexX, y: leftIndexY, z: -0.15, visibility: 0.99 }; // left index
    landmarks[21] = { x: leftThumbX, y: leftThumbY, z: -0.14, visibility: 0.99 }; // left thumb

    const rightIndexX = rwRef.x + 0.02 - rightPinchFactor * 0.015;
    const rightIndexY = rwRef.y - 0.06 + rightPinchFactor * 0.015;
    const rightThumbX = rwRef.x - 0.01 + rightPinchFactor * 0.015;
    const rightThumbY = rwRef.y - 0.025 - rightPinchFactor * 0.02;

    landmarks[18] = { x: rwRef.x + 0.035, y: rwRef.y - 0.01, z: 0.15, visibility: 0.99 }; // right pinky
    landmarks[20] = { x: rightIndexX, y: rightIndexY, z: 0.15, visibility: 0.99 }; // right index
    landmarks[22] = { x: rightThumbX, y: rightThumbY, z: 0.14, visibility: 0.99 }; // right thumb
  }

  return landmarks;
}

// Global Biomechanical Sentry to detect if a completely wrong exercise is in progress
export function detectMovementMismatch(
  pts: Landmark[],
  selectedExercise: ExerciseType
): { mismatchDetected: boolean; perceivedExercise: string; warningText: string } {
  if (!pts || pts.length < 29) {
    return { mismatchDetected: false, perceivedExercise: '', warningText: '' };
  }

  const leftHip = pts[23], leftKnee = pts[25], leftAnkle = pts[27];
  const rightHip = pts[24], rightKnee = pts[26], rightAnkle = pts[28];
  const shoulderLeft = pts[11], shoulderRight = pts[12];
  const elbowLeft = pts[13], elbowRight = pts[14];
  const wristLeft = pts[15], wristRight = pts[16];

  if (!leftHip || !leftKnee || !leftAnkle || !shoulderLeft) {
    return { mismatchDetected: false, perceivedExercise: '', warningText: '' };
  }

  const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
  const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
  const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

  const leftElbowAngle = calculateAngle(shoulderLeft, elbowLeft, wristLeft);
  const rightElbowAngle = calculateAngle(shoulderRight, elbowRight, wristRight);
  const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

  // Determine if user is in horizontal stance (Pushup/Plank position)
  // Normally the shoulder y and ankle y differ significantly (standing: shoulder y ≈ 0.35, ankle y ≈ 0.85, diff ≈ 0.50)
  // In pushups, the body stretches horizontally, and shoulder y is closer to ankle y (e.g. diff < 0.28, and shoulder is low to ground)
  const yDiff = Math.abs(shoulderLeft.y - leftAnkle.y);
  const xDiff = Math.abs(shoulderLeft.x - leftAnkle.x);
  
  // A high hip altitude (y coordinate less than 0.7) merged with thin horizontal slope represents pushup alignment
  const isHorizontalProne = yDiff < 0.28 && xDiff > 0.32 && leftHip.y > 0.40;

  // 1. If currently selected exercise is NOT Pushups, but they are flat in a Prone shape
  if (isHorizontalProne && selectedExercise !== 'Pushups' && selectedExercise !== 'Cobra Pose' && selectedExercise !== 'Downward Dog') {
    return {
      mismatchDetected: true,
      perceivedExercise: 'Pushups / Planks',
      warningText: `⚠️ WRONG EXERCISE: Prone Pushup/Plank stance detected. This is incorrect for ${selectedExercise}. Please stand up.`
    };
  }

  // 2. If currently selected exercise is NOT Squats, but they are doing deep knee bends
  if (avgKneeAngle < 132 && selectedExercise !== 'Squats' && selectedExercise !== 'Warrior II' && selectedExercise !== 'Tree Pose' && selectedExercise !== 'Downward Dog' && selectedExercise !== 'Cobra Pose') {
    return {
      mismatchDetected: true,
      perceivedExercise: 'Squats',
      warningText: `⚠️ WRONG EXERCISE: Deep knee squats detected, which is incorrect for focused "${selectedExercise}".`
    };
  }

  // 3. If selected exercise is local (Finger Pinch Drill or Facial Mobility) but there's massive whole-body exercise movement
  if (selectedExercise === 'Finger Pinch Drill' || selectedExercise === 'Facial Mobility') {
    if (avgKneeAngle < 140) {
      return {
        mismatchDetected: true,
        perceivedExercise: 'Squats',
        warningText: `⚠️ EXTREME FORM MISMATCH: Performing Squats during focused ${selectedExercise}! Stop, rest, and keep core focused.`
      };
    }
    if (isHorizontalProne) {
      return {
        mismatchDetected: true,
        perceivedExercise: 'Pushups / Planks',
        warningText: `⚠️ EXTREME FORM MISMATCH: Performing Pushups/Planks during focused ${selectedExercise}! Return to sitting or standing posture.`
      };
    }
    if (avgElbowAngle < 105 && selectedExercise === 'Facial Mobility') {
      return {
        mismatchDetected: true,
        perceivedExercise: 'Bicep Curls / Shoulder Presses',
        warningText: `⚠️ EXTREME FORM MISMATCH: Arm movement detected during Facial Mobility. Keep upper body stationary.`
      };
    }
  }

  return { mismatchDetected: false, perceivedExercise: '', warningText: '' };
}
