const mongoose = require('mongoose');
const Category = require('./models/category.model');
const Gig = require('./models/gig.model');

async function testAggregation() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hellocer'); // Adjust DB name if needed
    console.log('Connected to DB');

    const categories = await Category.aggregate([
      {
        $lookup: {
          from: 'gigs',
          let: { categoryId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $in: ['$$categoryId', '$category'] },
                isActive: true,
                status: 'published'
              }
            }
          ],
          as: 'activeGigs'
        }
      },
      {
        $addFields: {
          gigCount: { $size: '$activeGigs' }
        }
      },
      {
        $project: {
          name: 1,
          gigCount: 1
        }
      }
    ]);

    console.log('Aggregation Results:', JSON.stringify(categories, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testAggregation();
