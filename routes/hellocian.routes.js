const express = require('express');
const router = express.Router();
const hellocianController = require('../controllers/hellocian.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');

// Admin/Super-Admin: create a hellocian account
router.post(
  '/create',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.createHellocian
);

// Public: hellocian sets their password using the one-time token
router.post('/setup-password', hellocianController.setupPassword);

// Public: list hellocians for /hire-talents
router.get('/public', hellocianController.getPublicHellocians);

// Admin/Super-Admin: list all hellocians
router.get(
  '/',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.getHellocians
);

// Admin/Super-Admin: list only activated hellocians (for gig assignment)
router.get(
  '/active',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.getActiveHellocians
);

// Admin/Super-Admin: list all trashed hellocians
router.get(
  '/trash',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.getTrashedHellocians
);

// Admin/Super-Admin: bulk delete hellocians
router.post(
  '/bulk-delete',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.bulkDeleteHellocians
);

// Admin/Super-Admin: get a single hellocian by ID
router.get(
  '/:id',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.getHellocianById
);

// Admin/Super-Admin: block/unblock a hellocian
router.patch(
  '/:id/toggle-block',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.toggleBlockHellocian
);

// Admin/Super-Admin: soft delete a hellocian
router.delete(
  '/:id',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.deleteHellocian
);

// Admin/Super-Admin: restore a hellocian
router.patch(
  '/:id/restore',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.restoreHellocian
);

// Admin/Super-Admin: hard delete a hellocian
router.delete(
  '/:id/hard',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.hardDeleteHellocian
);

module.exports = router;
