import { Task } from "../../models/task.model";
import { TaskAttempt } from "../../models/taskAttempt.model";
import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { toTaskAttemptDto, toTaskDto, type TaskAttemptDto, type TaskDto } from "../../lib/serialize";

export async function createTask(input: {
  code: string;
  title: string;
  description?: string;
}): Promise<TaskDto> {
  if (await Task.findOne({ code: input.code }).lean()) {
    throw AppError.conflict("A task with this code already exists");
  }
  const task = await Task.create(input);
  return toTaskDto(task);
}

export async function listTasks(): Promise<TaskDto[]> {
  const tasks = await Task.find().sort({ createdAt: 1 });
  return tasks.map(toTaskDto);
}

export async function updateTask(
  id: string,
  input: { title?: string; description?: string | null },
): Promise<TaskDto> {
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  const task = await Task.findByIdAndUpdate(id, update, { new: true });
  if (!task) throw AppError.notFound("Task not found");
  return toTaskDto(task);
}

export async function assignTask(taskId: string, participantId: string): Promise<TaskAttemptDto> {
  const [task, participant] = await Promise.all([
    Task.findById(taskId).lean(),
    User.findById(participantId).lean(),
  ]);
  if (!task) throw AppError.notFound("Task not found");
  if (!participant) throw AppError.notFound("Participant not found");

  const attempt = await TaskAttempt.create({ taskId, participantId, status: "ASSIGNED" });
  return toTaskAttemptDto(attempt);
}

export async function listTaskAttempts(filter: {
  participantId?: string;
  taskId?: string;
}): Promise<TaskAttemptDto[]> {
  const query: Record<string, unknown> = {};
  if (filter.participantId) query.participantId = filter.participantId;
  if (filter.taskId) query.taskId = filter.taskId;
  const attempts = await TaskAttempt.find(query).sort({ createdAt: 1 });
  return attempts.map(toTaskAttemptDto);
}

export async function updateTaskAttempt(
  id: string,
  input: {
    status?: "ASSIGNED" | "STARTED" | "COMPLETED" | "FAILED";
    metrics?: { durationMs?: number | null; errorCount?: number; helpRequests?: number };
    notes?: string | null;
  },
): Promise<TaskAttemptDto> {
  const attempt = await TaskAttempt.findById(id);
  if (!attempt) throw AppError.notFound("Task attempt not found");

  if (input.status !== undefined) {
    attempt.status = input.status;
    if (input.status === "STARTED" && !attempt.startedAt) attempt.startedAt = new Date();
    if (input.status === "COMPLETED" || input.status === "FAILED") attempt.completedAt = new Date();
  }
  if (input.metrics) {
    if (input.metrics.durationMs !== undefined) attempt.metrics.durationMs = input.metrics.durationMs;
    if (input.metrics.errorCount !== undefined) attempt.metrics.errorCount = input.metrics.errorCount;
    if (input.metrics.helpRequests !== undefined) {
      attempt.metrics.helpRequests = input.metrics.helpRequests;
    }
  }
  if (input.notes !== undefined) attempt.notes = input.notes;

  await attempt.save();
  return toTaskAttemptDto(attempt);
}
