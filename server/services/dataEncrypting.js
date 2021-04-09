const bcrypt = require("bcrypt");

const encryptingData = (data) => {
  const saltRounds = 10;
  return bcrypt.hash(data.toString(), saltRounds);
};

module.exports = encryptingData;
