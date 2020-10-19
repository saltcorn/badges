const badges = require("./show");
const edit = require("./edit");
module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [badges, edit],
};
