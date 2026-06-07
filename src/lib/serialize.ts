import type { IAdmin } from "../models/admin.model";
import type { IContact } from "../models/contact.model";
import type { IConversation } from "../models/conversation.model";
import type { IMessage } from "../models/message.model";
import type { ITask } from "../models/task.model";
import type { ITaskAttempt } from "../models/taskAttempt.model";
import type { IUser } from "../models/user.model";

/**
 * Wire DTOs (TDD §5.2). Models expose `_id` as an ObjectId; the API exposes `id` as a
 * string and never leaks `passwordHash`. These mappers are the single source of truth
 * for participant/admin response shapes (contract-tested in Phase 8).
 */
export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
}

export interface AdminDto {
  id: string;
  email: string;
  displayName: string;
}

export function toUserDto(user: Pick<IUser, "_id" | "username" | "displayName" | "avatarUrl" | "status">): UserDto {
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    status: user.status,
  };
}

export function toAdminDto(admin: Pick<IAdmin, "_id" | "email" | "displayName">): AdminDto {
  return {
    id: admin._id.toString(),
    email: admin.email,
    displayName: admin.displayName,
  };
}

export interface ContactDto {
  id: string;
  user: UserDto;
  alias: string | null;
}

/** A contact wraps the referenced user (app contract: `ContactDto = { id, user, alias }`). */
export function toContactDto(
  contact: Pick<IContact, "_id" | "alias">,
  user: Parameters<typeof toUserDto>[0],
): ContactDto {
  return {
    id: contact._id.toString(),
    user: toUserDto(user),
    alias: contact.alias ?? null,
  };
}

export interface LastMessageDto {
  text: string | null;
  type: string;
  senderId: string;
  sentAt: string;
}

export interface ConversationDto {
  id: string;
  peer: UserDto;
  lastMessage: LastMessageDto | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

/**
 * A conversation is rendered relative to the caller: `peer` is the other participant
 * and `unreadCount` is the caller's own unread counter (app contract).
 */
export function toConversationDto(
  conversation: Pick<IConversation, "_id" | "participants" | "lastMessage" | "lastMessageAt">,
  callerId: string,
  peer: Parameters<typeof toUserDto>[0],
): ConversationDto {
  const callerPart = conversation.participants.find((p) => p.userId.toString() === callerId);
  const last = conversation.lastMessage;
  return {
    id: conversation._id.toString(),
    peer: toUserDto(peer),
    lastMessage:
      last && last.sentAt
        ? {
            text: last.text ?? null,
            type: last.type,
            senderId: last.senderId.toString(),
            sentAt: last.sentAt.toISOString(),
          }
        : null,
    lastMessageAt: conversation.lastMessageAt ? conversation.lastMessageAt.toISOString() : null,
    unreadCount: callerPart?.unreadCount ?? 0,
  };
}

export interface MessageDto {
  id: string;
  clientId: string;
  conversationId: string;
  senderId: string;
  type: string;
  text: string | null;
  mediaUrl: string | null;
  status: string;
  sentAt: string;
}

export function toMessageDto(message: IMessage): MessageDto {
  return {
    id: message._id.toString(),
    clientId: message.clientId,
    conversationId: message.conversationId.toString(),
    senderId: message.senderId.toString(),
    type: message.type,
    text: message.text ?? null,
    mediaUrl: message.mediaUrl ?? null,
    status: message.status,
    sentAt: message.sentAt.toISOString(),
  };
}

export interface TaskDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
}

export function toTaskDto(task: ITask): TaskDto {
  return {
    id: task._id.toString(),
    code: task.code,
    title: task.title,
    description: task.description ?? null,
  };
}

export interface TaskAttemptDto {
  id: string;
  taskId: string;
  participantId: string;
  status: string;
  metrics: { durationMs: number | null; errorCount: number; helpRequests: number };
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export function toTaskAttemptDto(attempt: ITaskAttempt): TaskAttemptDto {
  return {
    id: attempt._id.toString(),
    taskId: attempt.taskId.toString(),
    participantId: attempt.participantId.toString(),
    status: attempt.status,
    metrics: {
      durationMs: attempt.metrics?.durationMs ?? null,
      errorCount: attempt.metrics?.errorCount ?? 0,
      helpRequests: attempt.metrics?.helpRequests ?? 0,
    },
    notes: attempt.notes ?? null,
    startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
    completedAt: attempt.completedAt ? attempt.completedAt.toISOString() : null,
  };
}
