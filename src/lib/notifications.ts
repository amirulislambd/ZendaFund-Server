import { Collection } from "mongodb";
import { sendGenericEmail } from "./stripe";

export type CollectionsLike = {
  notifications: Collection<any>;
  user?: Collection<any>;
};

export async function createNotification(collections: CollectionsLike, opts: {
  userId?: any;
  message: string;
  toEmail?: string;
  actionRoute?: string;
}) {
  const doc = {
    userId: opts.userId ?? null,
    message: opts.message,
    toEmail: opts.toEmail ?? null,
    actionRoute: opts.actionRoute ?? null,
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    time: new Date(),
  };

  try {
    await collections.notifications.insertOne(doc);
  } catch (err) {
    console.error("Failed to insert notification:", err);
  }

  // Send email copy when email address provided
  if (opts.toEmail) {
    const subject = "ZendaFund: You have a new notification";
    const text = opts.message + "\n\nView: " + (opts.actionRoute ?? "");
    const html = `<div style=\"font-family:Arial,sans-serif;max-width:620px;margin:auto\">` +
      `<p>${opts.message}</p>` +
      (opts.actionRoute ? `<p><a href=\"${process.env.NEXT_PUBLIC_BASE_URL}${opts.actionRoute}\">View</a></p>` : "") +
      `</div>`;

    try {
      await sendGenericEmail(opts.toEmail, subject, text, html);
    } catch (err) {
      console.error("Failed to send notification email copy:", err);
    }
  }

  return doc;
}
