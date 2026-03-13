const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');

// All routes are protected and restricted to admin/super-admin
router.use(protect);
router.use(restrictTo('admin', 'super-admin'));

// List all active clients
router.get('/', clientController.getClients);

// List trashed clients
router.get('/trash', clientController.getTrashedClients);

// Bulk actions
router.post('/bulk-delete', clientController.bulkDeleteClients);

// Toggle block
router.patch('/:id/toggle-block', clientController.toggleBlockClient);

// Soft delete
router.delete('/:id', clientController.deleteClient);

// Restore
router.patch('/:id/restore', clientController.restoreClient);

// Hard delete
router.delete('/:id/hard', clientController.hardDeleteClient);

module.exports = router;
