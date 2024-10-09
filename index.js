const badges = require("./show");
const edit = require("./edit");
const like = require("./like");
module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [badges, edit, like],
  ready_for_mobile: true,
};
