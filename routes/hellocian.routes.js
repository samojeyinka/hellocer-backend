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

// Admin/Super-Admin: list all hellocians
router.get(
  '/',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.getHellocians
);

// Admin/Super-Admin: get a single hellocian by ID
router.get(
  '/:id',
  protect,
  restrictTo('admin', 'super-admin'),
  hellocianController.getHellocianById
);

module.exports = router;
