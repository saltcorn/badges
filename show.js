const { span, p, code } = require("@saltcorn/markup/tags");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const db = require("@saltcorn/data/db");
const {
  stateFieldsToWhere,
  picked_fields_to_query,
} = require("@saltcorn/data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Badge relation",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const mytable = table;
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
                agg_field_opts.push({
                  name: `${table.name}.${key_field.name}.${f.name}`,
                  label: `${table.name}.${key_field.name}&#8594;${f.name}`,
                });
              });
          });
          for (const { table, key_field } of child_relations) {
            const keyFields = table.fields.filter(
              (f) =>
                f.type === "Key" &&
                ![mytable.name, "users", "_sc_files"].includes(f.reftable_name)
            );
            for (const kf of keyFields) {
              const joined_table = await Table.findOne({
                name: kf.reftable_name,
              });
              if (!joined_table) continue;
              await joined_table.getFields();
              joined_table.fields.forEach((jf) => {
                agg_field_opts.push({
                  label: `${table.name}.${key_field.name}&#8594;${kf.name}&#8594;${jf.name}`,
                  name: `${table.name}.${key_field.name}.${kf.name}.${jf.name}`,
                });
              });
            }
          }
          return new Form({
            blurb: "Choose the relation that defines the content of the badges",
            fields: [
              {
                name: "relation",
                label: "Relation",
                sublabel:
                  "Choose a <ul><li>one-to-many relation (Table.foreignKey&#8594;badgeLabel) or a </li><li>many-to-many relation (JoinTable.foreignKey&#8594;keyToTableWithLabels&#8594;badgeLabel) </li> </ul>",
                type: "String",
                required: true,
                attributes: {
                  options: agg_field_opts,
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
  const { id } = state;
  if (!id) return "need id";
  const relSplit = relation.split(".");
  if (relSplit.length < 3) {
    throw new Error("badges view incorrectly configured. No relation chosen");
  }
  if (relSplit.length === 3) {
    const [relTableNm, relField, valField] = relSplit;

    const relTable = await Table.findOne({ name: relTableNm });
    const rows = await relTable.getJoinedRows({
      where: { [relField]: id },
    });

    return rows
      .map((row) => span({ class: "badge badge-secondary" }, row[valField]))
      .join("&nbsp;");
  } else {
    const [relTableNm, relField, joinFieldNm, valField] = relSplit;
    const table = await Table.findOne({ id: table_id });

    const relTable = await Table.findOne({ name: relTableNm });
    await relTable.getFields();
    const joinField = relTable.fields.find((f) => f.name === joinFieldNm);

    const rows = await table.getJoinedRows({
      where: { id },
      aggregations: {
        _badges: {
          table: joinField.reftable_name,
          ref: "id",
          subselect: {
            field: joinFieldNm,
            table: relTable,
            whereField: relField,
          },
          field: valField,
          aggregate: "ARRAY_AGG",
        },
      },
    });
    return (rows[0]._badges || [])
      .map((b) => span({ class: "badge badge-secondary" }, b))
      .join("&nbsp;");
  }
};
const runMany = async (table_id, viewname, { relation }, state, extra) => {
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();
  const qstate = await stateFieldsToWhere({ fields, state });
  const relSplit = relation.split(".");
  if (relSplit.length < 3) {
    throw new Error("badges view incorrectly configured. No relation chosen");
  }
  if (relSplit.length === 3) {
    const [relTableNm, relField, valField] = relSplit;
    const rows = await tbl.getJoinedRows({
      where: qstate,
      aggregations: {
        _badges: {
          table: relTableNm,
          ref: relField,
          field: valField,
          aggregate: "ARRAY_AGG",
        },
      },
      ...(extra && extra.orderBy && { orderBy: extra.orderBy }),
      ...(extra && extra.orderDesc && { orderDesc: extra.orderDesc }),
    });

    return rows.map((row) => ({
      html: row._badges
        .map((b) => span({ class: "badge badge-secondary" }, b))
        .join("&nbsp;"),
      row,
    }));
  } else {
    const [relTableNm, relField, joinFieldNm, valField] = relSplit;

    const relTable = await Table.findOne({ name: relTableNm });
    await relTable.getFields();
    const joinField = relTable.fields.find((f) => f.name === joinFieldNm);

    const rows = await tbl.getJoinedRows({
      where: qstate,
      aggregations: {
        _badges: {
          table: joinField.reftable_name,
          ref: "id",
          subselect: {
            field: joinFieldNm,
            table: relTable,
            whereField: relField,
          },
          field: valField,
          aggregate: "ARRAY_AGG",
        },
      },
    });
    return rows.map((row) => ({
      html: (row._badges || [])
        .map((b) => span({ class: "badge badge-secondary" }, b))
        .join("&nbsp;"),
      row,
    }));
  }
};
module.exports = {
  name: "Badges",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
  runMany,
};
