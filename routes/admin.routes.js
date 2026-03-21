const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');



// Super-Admin: list all active admins
router.get(
  '/manage',
  protect,
  restrictTo('super-admin'),
  adminController.getAdmins
);

// Super-Admin: list all trashed admins
router.get(
  '/manage/trash',
  protect,
  restrictTo('super-admin'),
  adminController.getTrashedAdmins
);

// Super-Admin: bulk delete admins
router.post(
  '/manage/bulk-delete',
  protect,
  restrictTo('super-admin'),
  adminController.bulkDeleteAdmins
);

// Super-Admin: block/unblock an admin
router.patch(
  '/manage/:id/toggle-block',
  protect,
  restrictTo('super-admin'),
  adminController.toggleBlockAdmin
);

// Super-Admin: soft delete an admin
router.delete(
  '/manage/:id',
  protect,
  restrictTo('super-admin'),
  adminController.deleteAdmin
);

// Super-Admin: restore an admin
router.patch(
  '/manage/:id/restore',
  protect,
  restrictTo('super-admin'),
  adminController.restoreAdmin
);

// Super-Admin: hard delete an admin
router.delete(
  '/manage/:id/hard',
  protect,
  restrictTo('super-admin'),
  adminController.hardDeleteAdmin
);

module.exports = router;
