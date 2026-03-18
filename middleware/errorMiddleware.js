const duplicateMessages = {
  email: "Email already registered",
  phone: "Phone number already registered",
  username: "Username is no longer required. Please try again."
};

const errorMiddleware = (err, req, res, next) => {
  console.error(err);

  if (err?.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || err.keyValue || {})[0];
    return res.status(400).json({
      success: false,
      message: duplicateMessages[duplicateField] || "Duplicate value already exists"
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something went wrong"
  });
};

export default errorMiddleware;
