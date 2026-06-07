import { Conversation } from "../../models/conversation.model";
import { Media } from "../../models/media.model";
import { Message } from "../../models/message.model";
import { AppError } from "../../lib/errors";
import { toMessageDto, type MessageDto } from "../../lib/serialize";
import { findParticipantConversation, peerIdOf } from "../conversations/conversations.service";
import type { ListMessagesQuery, SendMessageInput } from "./messages.validation";

const DEFAULT_LIMIT = 50;

export interface MessagesPage {
  messages: MessageDto[];
  nextCursor: string | null;
}

export async function listMessages(
  callerId: string,
  conversationId: string,
  query: ListMessagesQuery,
): Promise<MessagesPage> {
  await findParticipantConversation(conversationId, callerId);

  const limit = query.limit ?? DEFAULT_LIMIT;
  let docs;
  if (query.since) {
    docs = await Message.find({ conversationId, sentAt: { $gt: new Date(query.since) } })
      .sort({ sentAt: 1 })
      .limit(limit);
  } else {
    // No cursor → return the most recent page in chronological order.
    docs = (await Message.find({ conversationId }).sort({ sentAt: -1 }).limit(limit)).reverse();
  }

  const nextCursor = docs.length
    ? docs[docs.length - 1].sentAt.toISOString()
    : (query.since ?? null);

  return { messages: docs.map(toMessageDto), nextCursor };
}

export interface SendMessageResult {
  message: MessageDto;
  created: boolean;
}

export async function sendMessage(
  callerId: string,
  conversationId: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const conversation = await findParticipantConversation(conversationId, callerId);

  // Idempotency: a replayed clientId returns the already-stored message (TDD §5.5, §10).
  const existing = await Message.findOne({ conversationId, clientId: input.clientId });
  if (existing) {
    return { message: toMessageDto(existing), created: false };
  }

  // Resolve the message body by type.
  let text: string | null = null;
  let mediaUrl: string | null = null;
  if (input.type === "TEXT") {
    if (!input.text || input.text.trim().length === 0) {
      throw AppError.validation("A text message requires non-empty text");
    }
    text = input.text;
  } else {
    if (!input.mediaId) throw AppError.validation("An image message requires a mediaId");
    const media = await Media.findOne({ _id: input.mediaId, ownerId: callerId });
    if (!media) throw AppError.notFound("Media not found");
    mediaUrl = media.url;
  }

  const recipientId = peerIdOf(conversation, callerId);
  const sentAt = new Date();

  let message;
  try {
    message = await Message.create({
      conversationId,
      senderId: callerId,
      type: input.type,
      text,
      mediaUrl,
      clientId: input.clientId,
      status: "SENT",
      sentAt,
    });
  } catch (err) {
    // Lost a race on the unique (conversationId, clientId) index → return the winner.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Message.findOne({ conversationId, clientId: input.clientId });
      if (winner) return { message: toMessageDto(winner), created: false };
    }
    throw err;
  }

  // Denormalize lastMessage and bump the recipient's unread counter (TDD §5.5).
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: { text, type: input.type, senderId: callerId, sentAt },
        lastMessageAt: sentAt,
      },
      $inc: { "participants.$[r].unreadCount": 1 },
    },
    { arrayFilters: [{ "r.userId": recipientId }] },
  );

  return { message: toMessageDto(message), created: true };
}
