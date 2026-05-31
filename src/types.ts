export type ExerciseType = 'Squats' | 'Bicep Curls' | 'Overhead Press' | 'Pushups' | 'Warrior II' | 'Tree Pose' | 'Downward Dog' | 'Cobra Pose' | 'Finger Pinch Drill' | 'Facial Mobility';

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface JointAngleMetrics {
  label: string;
  current: number;
  target: number;
  tolerance: number;
  isValid: boolean;
}

export interface ExerciseDefinition {
  name: ExerciseType;
  description: string;
  jointAnalyses: {
    name: string;
    description: string;
    calculateAngle: (landmarks: Landmark[], isRightSide?: boolean) => number;
    targetRange: { min: number; max: number };
  }[];
  biomechanicalCues: string[];
  commonFailures: {
    triggerCondition: (angles: { [key: string]: number }) => boolean;
    warningText: string;
  }[];
}

export interface SessionStats {
  exercise: ExerciseType;
  repCount: number;
  precisionScore: number; // 0-100
  symmetryScore: number; // 0-100
  postureScore: number; // 0-100
  duration: number; // in seconds
  feedbackHistory: string[];
  angleStats: {
    [key: string]: number;
  };
}
