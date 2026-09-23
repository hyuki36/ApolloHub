// GET /api/raw — decoy giong sodium cu: luon tra trang den.
// Link that dung /api/r?id=..&k=.. — route nay chi de danh lac tool quet.
const { sendBlank } = require('../lib/detect');

module.exports = async function handler(req, res) {
  return sendBlank(res);
};
