import mongoose, { type Model, Schema, type Types } from "mongoose";

export const MESSAGE_TYPES = ["TEXT", "IMAGE"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export interface IParticipant {
  userId: Types.ObjectId;
  unreadCount: number;
  lastReadAt: Date | null;
}

export interface ILastMessage {
  text: string | null;
  type: MessageType;
  senderId: Types.ObjectId;
  sentAt: Date;
}

export interface IConversation {
  _id: Types.ObjectId;
  participants: IParticipant[];
  lastMessage: ILastMessage | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    unreadCount: { type: Number, default: 0, min: 0 },
    lastReadAt: { type: Date, default: null },
  },
  { _id: false },
);

const lastMessageSchema = new Schema<ILastMessage>(
  {
    text: { type: String, default: null },
    type: { type: String, enum: MESSAGE_TYPES, default: "TEXT" },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date },
  },
  { _id: false },
);

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [participantSchema],
      required: true,
      validate: {
        validator: (v: IParticipant[]) => Array.isArray(v) && v.length === 2,
        message: "A conversation must have exactly 2 participants",
      },
    },
    lastMessage: { type: lastMessageSchema, default: null },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// §7.4: chat-list + sync lookups by participant, newest first.
conversationSchema.index({ "participants.userId": 1, lastMessageAt: -1 });

export const Conversation: Model<IConversation> =
  (mongoose.models.Conversation as Model<IConversation>) ??
  mongoose.model<IConversation>("Conversation", conversationSchema);
