import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { idParam } from "../../lib/validators";
import * as contactsController from "./contacts.controller";
import { addContactSchema, updateContactSchema } from "./contacts.validation";

/** Contacts routes — mounted at `/api/v1/contacts`, all behind participant auth. */
export const contactsRouter = Router();

contactsRouter.use(requireAuth);
contactsRouter.get("/", asyncHandler(contactsController.list));
contactsRouter.post("/", validate(addContactSchema), asyncHandler(contactsController.add));
contactsRouter.patch(
  "/:id",
  validate({ params: idParam, body: updateContactSchema.body }),
  asyncHandler(contactsController.update),
);
contactsRouter.delete(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(contactsController.remove),
);
