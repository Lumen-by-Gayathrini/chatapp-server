import mongoose, { type Model, Schema, type Types } from "mongoose";

export interface ITask {
  _id: Types.ObjectId;
  code: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
  },
  { timestamps: true },
);

// §7.4: { code: 1 } unique (declared via field `unique` above). Maps to the study
// task codes SEND_MESSAGE / SEND_PHOTO / DELETE_CONVERSATION (TDD §6.5, §15).

export const Task: Model<ITask> =
  (mongoose.models.Task as Model<ITask>) ?? mongoose.model<ITask>("Task", taskSchema);
