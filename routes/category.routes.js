const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect } = require('../middleware/auth.middleware');
const { restrictTo, checkActivation } = require('../middleware/roleCheck.middleware');

router.get('/categories', categoryController.getAllCategories);
router.get('/tags', categoryController.getAllTags);



router.post('/categories',restrictTo('admin', 'super-admin'), categoryController.createCategory);
router.put('/categories/:categoryId',restrictTo('admin', 'super-admin'), categoryController.updateCategory);
router.delete('/categories/:categoryId',restrictTo('admin', 'super-admin'), categoryController.deleteCategory);

router.post('/tags',restrictTo('admin', 'super-admin'), categoryController.createTag);

module.exports = router;
