import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../lib/mongodb";
import { AuthRequest, verifyToken } from "../middleware/auth";

const router = Router();

// GET /api/notifications — list notifications for the logged-in user
router.get("/notifications", verifyToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const collections = await getCollections();

    const docs = await collections.notifications
      .find({ userId: new ObjectId(String(userId)) })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    const data = docs.map((d) => ({
      _id: String(d._id),
      message: d.message,
      read: Boolean(d.read),
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : (d.time ? new Date(d.time).toISOString() : new Date().toISOString()),
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to load notifications" });
  }
});

// PATCH /api/notifications/:id/read — mark as read
router.patch("/notifications/:id/read", verifyToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    if (!id || Array.isArray(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

    const userIdRaw = req.user?._id;
    if (!userIdRaw) return res.status(401).json({ success: false, message: "Unauthorized" });

    const userId = new ObjectId(String(userIdRaw));

    const collections = await getCollections();

    const result = await collections.notifications.updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { read: true, updatedAt: new Date() } },
    );

    if (!result.matchedCount) return res.status(404).json({ success: false, message: "Notification not found" });

    return res.status(200).json({ success: true, message: "Marked as read" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to mark notification" });
  }
});

// DELETE /api/notifications/:id — delete notification
router.delete("/notifications/:id", verifyToken, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    if (!id || Array.isArray(id)) return res.status(400).json({ success: false, message: "Invalid id" });
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid id" });

    const userIdRaw = req.user?._id;
    if (!userIdRaw) return res.status(401).json({ success: false, message: "Unauthorized" });

    const userId = new ObjectId(String(userIdRaw));

    const collections = await getCollections();

    const result = await collections.notifications.deleteOne({ _id: new ObjectId(id), userId });
    if (!result.deletedCount) return res.status(404).json({ success: false, message: "Notification not found" });

    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
});

export default router;
