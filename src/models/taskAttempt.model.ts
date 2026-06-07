import mongoose, { type Model, Schema, type Types } from "mongoose";

export const TASK_ATTEMPT_STATUSES = ["ASSIGNED", "STARTED", "COMPLETED", "FAILED"] as const;
export type TaskAttemptStatus = (typeof TASK_ATTEMPT_STATUSES)[number];

export interface ITaskMetrics {
  durationMs: number | null;
  errorCount: number;
  helpRequests: number;
}

export interface ITaskAttempt {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  participantId: Types.ObjectId;
  status: TaskAttemptStatus;
  metrics: ITaskMetrics;
  notes: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const metricsSchema = new Schema<ITaskMetrics>(
  {
    durationMs: { type: Number, default: null },
    errorCount: { type: Number, default: 0, min: 0 },
    helpRequests: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const taskAttemptSchema = new Schema<ITaskAttempt>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    participantId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: TASK_ATTEMPT_STATUSES, default: "ASSIGNED" },
    metrics: { type: metricsSchema, default: () => ({}) },
    notes: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// §7.4: metrics queries by participant + task.
taskAttemptSchema.index({ participantId: 1, taskId: 1 });

export const TaskAttempt: Model<ITaskAttempt> =
  (mongoose.models.TaskAttempt as Model<ITaskAttempt>) ??
  mongoose.model<ITaskAttempt>("TaskAttempt", taskAttemptSchema);
