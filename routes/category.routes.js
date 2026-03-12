const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo } = require('../middleware/roleCheck.middleware');

router.get('/categories', categoryController.getAllCategories);
router.get('/tags', categoryController.getAllTags);

router.post('/categories', protect, restrictTo('admin', 'super-admin'), categoryController.createCategory);
router.put('/categories/:categoryId', protect, restrictTo('admin', 'super-admin'), categoryController.updateCategory);
router.delete('/categories/:categoryId', protect, restrictTo('admin', 'super-admin'), categoryController.deleteCategory);

router.post('/tags', protect, restrictTo('admin', 'super-admin'), categoryController.createTag);

module.exports = router;
