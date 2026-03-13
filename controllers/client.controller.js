const User = require('../models/user.model');
const Order = require('../models/order.model');
const EmailService = require('../services/email.service');

/**
 * @desc    Get all Clients (role: user)
 * @route   GET /api/clients
 * @access  Private (admin, super-admin)
 */
exports.getClients = async (req, res) => {
  try {
    const clients = await User.find({ role: 'user', deletedAt: null })
      .select('-password -refreshToken -passwordSetupToken -passwordSetupTokenExpires -resetPasswordToken')
      .sort({ createdAt: -1 });

    const clientsWithStats = await Promise.all(clients.map(async (client) => {
      const orderCount = await Order.countDocuments({ clientId: client._id });
      const completedOrders = await Order.find({ clientId: client._id, status: 'completed' });
      const totalSpent = completedOrders.reduce((sum, order) => sum + (order.price || 0), 0);

      return {
        ...client.toObject(),
        orderCount,
        totalSpent
      };
    }));

    res.json({
      success: true,
      count: clients.length,
      clients: clientsWithStats
    });
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients', details: error.message });
  }
};

/**
 * @desc    Get all Trashed Clients
 * @route   GET /api/clients/trash
 * @access  Private (admin, super-admin)
 */
exports.getTrashedClients = async (req, res) => {
  try {
    const clients = await User.find({ role: 'user', deletedAt: { $ne: null } })
      .select('-password -refreshToken')
      .sort({ deletedAt: -1 });

    res.json({
      success: true,
      count: clients.length,
      clients
    });
  } catch (error) {
    console.error('Get trashed clients error:', error);
    res.status(500).json({ error: 'Failed to fetch trashed clients', details: error.message });
  }
};

/**
 * @desc    Toggle block status of a Client
 * @route   PATCH /api/clients/:id/toggle-block
 * @access  Private (admin, super-admin)
 */
exports.toggleBlockClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const client = await User.findOne({ _id: id, role: 'user', deletedAt: null });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    client.isBlocked = !client.isBlocked;
    
    const displayName = client.firstName || 'Client';
    
    if (client.isBlocked) {
      client.blockedBy = req.user._id;
      client.blockedAt = new Date();
      if (EmailService.sendAccountBlockedEmail) {
        await EmailService.sendAccountBlockedEmail(client.email, displayName, reason);
      }
    } else {
      client.blockedBy = undefined;
      client.blockedAt = undefined;
      if (EmailService.sendAccountUnblockedEmail) {
        await EmailService.sendAccountUnblockedEmail(client.email, displayName);
      }
    }
    
    await client.save({ validateBeforeSave: false });
    
    res.json({ 
      success: true, 
      message: client.isBlocked ? 'Client blocked successfully' : 'Client unblocked successfully', 
      client 
    });
  } catch (error) {
    console.error('Toggle block client error:', error);
    res.status(500).json({ error: 'Failed to toggle block status', details: error.message });
  }
};

/**
 * @desc    Soft delete a Client
 * @route   DELETE /api/clients/:id
 * @access  Private (admin, super-admin)
 */
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'user', deletedAt: null });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    client.deletedAt = new Date();
    await client.save({ validateBeforeSave: false });
    
    if (EmailService.sendAccountDeletedEmail) {
      await EmailService.sendAccountDeletedEmail(client.email, client.firstName || 'Client');
    }
    
    res.json({ success: true, message: 'Client moved to trash' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client', details: error.message });
  }
};

/**
 * @desc    Restore a soft-deleted Client
 * @route   PATCH /api/clients/:id/restore
 * @access  Private (admin, super-admin)
 */
exports.restoreClient = async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOne({ _id: id, role: 'user' });
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    if (client.deletedAt === null) {
        return res.json({ success: true, message: 'Client is already active', client });
    }
    
    client.deletedAt = null;
    await client.save({ validateBeforeSave: false });
    
    if (EmailService.sendAccountRestoredEmail) {
      await EmailService.sendAccountRestoredEmail(client.email, client.firstName || 'Client');
    }

    res.json({ success: true, message: 'Client restored successfully', client });
  } catch (error) {
    console.error('Restore client error:', error);
    res.status(500).json({ error: 'Failed to restore client', details: error.message });
  }
};

/**
 * @desc    Permanently delete a Client
 * @route   DELETE /api/clients/:id/hard
 * @access  Private (admin, super-admin)
 */
exports.hardDeleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await User.findOneAndDelete({ _id: id, role: 'user', deletedAt: { $ne: null } });
    if (!client) {
      return res.status(404).json({ error: 'Trashed client not found' });
    }
    
    res.json({ success: true, message: 'Client permanently deleted' });
  } catch (error) {
    console.error('Hard delete client error:', error);
    res.status(500).json({ error: 'Failed to permanently delete client', details: error.message });
  }
};

/**
 * @desc    Bulk Action (soft or hard delete) Clients
 * @route   POST /api/clients/bulk-delete
 * @access  Private (admin, super-admin)
 */
exports.bulkDeleteClients = async (req, res) => {
  try {
    const { ids, action } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Please provide client IDs' });
    }

    if (action === 'hard') {
      await User.deleteMany({ _id: { $in: ids }, role: 'user', deletedAt: { $ne: null } });
      return res.json({ success: true, message: `${ids.length} Clients permanently deleted` });
    } else {
      await User.updateMany(
        { _id: { $in: ids }, role: 'user', deletedAt: null },
        { $set: { deletedAt: new Date() } }
      );
      return res.json({ success: true, message: `${ids.length} Clients moved to trash` });
    }
  } catch (error) {
    console.error('Bulk delete clients error:', error);
    res.status(500).json({ error: 'Failed to bulk delete clients', details: error.message });
  }
};
