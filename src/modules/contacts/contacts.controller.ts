import type { Request, Response } from "express";
import * as contactsService from "./contacts.service";

export async function list(req: Request, res: Response) {
  const contacts = await contactsService.listContacts(req.userId!);
  res.status(200).json(contacts);
}

export async function add(req: Request, res: Response) {
  const contact = await contactsService.addContact(req.userId!, req.body);
  res.status(201).json(contact);
}

export async function update(req: Request, res: Response) {
  const contact = await contactsService.updateContact(req.userId!, req.params.id, req.body);
  res.status(200).json(contact);
}

export async function remove(req: Request, res: Response) {
  await contactsService.removeContact(req.userId!, req.params.id);
  res.status(204).end();
}
