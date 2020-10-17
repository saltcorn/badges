const {
  input,
  div,
  text,
  script,
  span,
  style,
  button,
} = require("@saltcorn/markup/tags");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const db = require("@saltcorn/data/db");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const {
            child_field_list,
            child_relations,
          } = await table.get_child_relations();
          var agg_field_opts = [];
          child_relations.forEach(({ table, key_field }) => {
            table.fields
              .filter((f) => !f.calculated || f.stored)
              .forEach((f) => {
                agg_field_opts.push(
                  `${table.name}.${key_field.name}.${f.name}`
                );
              });
          });
          return new Form({
            fields: [
              {
                name: "relation",
                label: "Relation",
                type: "String",
                required: true,
                attributes: {
                  options: agg_field_opts.join(),
                },
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = async (table_id, viewname, { columns }) => [
  {
    name: "id",
    type: "Integer",
    required: true,
  },
];

const run = async (table_id, viewname, { relation }, state, extra) => {
  const [relTableNm, relField, valField] = relation.split(".");
  //db.sql_log({ relTableNm, relField, valField, relation });
  const { id } = state;
  if (!id) return "need id";
  const relTable = await Table.findOne({ name: relTableNm });
  const rows = await relTable.getJoinedRows({
    where: { [relField]: id },
  });

  return rows
    .map((row) => span({ class: "badge badge-secondary" }, row[valField]))
    .join("&nbsp;");
};
const runMany = async (table_id, viewname, { relation }, state, extra) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();
  const { joinFields, aggregations } = picked_fields_to_query(columns, fields);
  const qstate = await stateFieldsToWhere({ fields, state });
  const rows = await tbl.getJoinedRows({
    where: qstate,
    joinFields,
    aggregations,
    ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
    ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc }),
  });
  return rows.map((row) => ({
    html: span({ class: "badge badge-secondary" }, relation),
    row,
  }));
};
module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [
    {
      name: "Badges",
      display_state_form: false,
      get_state_fields,
      configuration_workflow,
      run,
      runMany,
    },
  ],
};
