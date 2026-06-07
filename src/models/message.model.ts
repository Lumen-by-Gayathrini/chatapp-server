import mongoose, { type Model, Schema, type Types } from "mongoose";
import { MESSAGE_TYPES, type MessageType } from "./conversation.model";

export const MESSAGE_STATUSES = ["SENT", "DELIVERED", "READ"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export interface IMessage {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: MessageType;
  text: string | null;
  mediaUrl: string | null;
  clientId: string;
  status: MessageStatus;
  sentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: MESSAGE_TYPES, default: "TEXT" },
    text: { type: String, default: null },
    mediaUrl: { type: String, default: null },
    clientId: { type: String, required: true },
    status: { type: String, enum: MESSAGE_STATUSES, default: "SENT" },
    sentAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

// §7.4: history + `since` polling window.
messageSchema.index({ conversationId: 1, sentAt: 1 });
// §7.4: send idempotency — clientId unique within a conversation.
messageSchema.index({ conversationId: 1, clientId: 1 }, { unique: true });

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ??
  mongoose.model<IMessage>("Message", messageSchema);
