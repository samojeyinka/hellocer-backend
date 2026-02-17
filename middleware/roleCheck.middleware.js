exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};

exports.checkActivation = (req, res, next) => {
  if (!req.user.isActivated) {
    return res.status(403).json({
      error: 'Please activate your account first',
      activationRequired: true
    });
  }
  next();
};