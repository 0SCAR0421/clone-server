const { sign, verify } = require('jsonwebtoken');

module.exports = {
  generateToken: async (user) => {
    const payload = {
      User_id: user.User_id,
      User_nickname: user.User_nickname,
      User_email: user.User_email
    };
    let result = {
      accessToken: sign(payload, process.env.ACCESS_SECRET, {
        expiresIn: '1d', // 1일간 유효한 토큰을 발행합니다.
      }),
    };
    return result;
  },
  verifyToken: async (type, token) => {
    let secretKey, decoded;
    switch (type) {
      case 'access':
        secretKey = process.env.ACCESS_SECRET;
        break;
      default:
        return null;
    }

    try {
      decoded = await verify(token, secretKey);
    } catch (err) {
      return null;
    }
    return decoded;
  },
};
