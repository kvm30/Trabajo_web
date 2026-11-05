const NotificationModel = require('../models/notification.model');
const socket = require('../socket');

const NotificationController = {
  async list(req, res) {
    try {
      const items = await NotificationModel.listForUser(req.user.id, req.user.role);
      const unread = await NotificationModel.unreadCount(req.user.id, req.user.role);
      res.json({ success: true, data: { items, unread } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  async read(req, res) {
    try {
      await NotificationModel.markRead(req.user.id, req.params.id || null);
      socket.emitNotificationsChanged(req.user.id);
      res.json({ success: true, data: { updated: true } });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = NotificationController;
