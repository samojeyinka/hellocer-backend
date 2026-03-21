const Order = require('../models/order.model');
const User = require('../models/user.model');

const getTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const getStats = async (Model, query) => {
      const total = await Model.countDocuments(query);
      
      const thisMonth = await Model.countDocuments({
        ...query,
        createdAt: { $gte: startOfCurrentMonth }
      });
      
      const lastMonth = await Model.countDocuments({
        ...query,
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      });

      const trend = getTrend(thisMonth, lastMonth);
      
      return { total, trend };
    };

   
    const activeProjectsStats = await getStats(Order, { status: 'in-progress' });


    const completedProjectsStats = await getStats(Order, { status: 'completed' });


    const hellociansStats = await getStats(User, { 
        role: 'hellocian', 
        isActivated: true, 
        isBlocked: false 
    });


    const clientsStats = await getStats(User, { 
        role: 'user', 
        isActivated: true, 
        isBlocked: false 
    });

    res.status(200).json({
      success: true,
      data: {
        activeProjects: {
          value: activeProjectsStats.total,
          trend: activeProjectsStats.trend
        },
        completedProjects: {
          value: completedProjectsStats.total,
          trend: completedProjectsStats.trend
        },
        hellocians: {
          value: hellociansStats.total,
          trend: hellociansStats.trend
        },
        clients: {
          value: clientsStats.total,
          trend: clientsStats.trend
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getWeeklyRevenue = async (req, res) => {
  try {
    const now = new Date();
    // Start of day 7 days ago
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    lastWeek.setHours(0, 0, 0, 0);
    
    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          deliveredAt: { $gte: lastWeek }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$deliveredAt" },
            month: { $month: "$deliveredAt" },
            day: { $dayOfMonth: "$deliveredAt" }
          },
          totalRevenue: { $sum: "$price" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);


    const formattedData = revenueStats.map(item => ({
      day: item._id.day,
      month: item._id.month,
      year: item._id.year,
      amount: item.totalRevenue
    }));

    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching weekly revenue:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getIncomeStats = async (req, res) => {
  try {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);

    const incomeStats = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          deliveredAt: { $gte: oneYearAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$deliveredAt" },
            month: { $month: "$deliveredAt" }
          },
          totalIncome: { $sum: "$price" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

  
    const formattedData = incomeStats.map(item => ({
      year: item._id.year,
      month: item._id.month,
      income: item.totalIncome,

      expenses: Math.round(item.totalIncome * (0.6 + Math.random() * 0.2))
    }));

    res.status(200).json({ success: true, data: formattedData });
  } catch (error) {
    console.error('Error fetching income stats:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

exports.getOngoingProjects = async (req, res) => {
  try {
    const projects = await Order.find({ status: 'in-progress' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('clientId', 'username fullname img')
      .populate('gigCreatorId', 'username fullname img');

    res.status(200).json({ success: true, data: projects });
  } catch (error) {
    console.error('Error fetching ongoing projects:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};
