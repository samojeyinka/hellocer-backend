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

    // 1. Active Projects (In Progress)
    const activeProjectsStats = await getStats(Order, { status: 'in-progress' });

    // 2. Completed Projects
    const completedProjectsStats = await getStats(Order, { status: 'completed' });

    // 3. Hellocians (Activated and not blocked)
    const hellociansStats = await getStats(User, { 
        role: 'hellocian', 
        isActivated: true, 
        isBlocked: false 
    });

    // 4. Clients Registered (Activated and not blocked)
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
