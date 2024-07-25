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
const { features } = require("@saltcorn/data/db/state");
const bs5 = features && features.bootstrap5;

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Badge relation",
        form: async (context) => {
          const table = Table.findOne({ id: context.table_id });
          const mytable = table;
          const fields = table.getFields();
          const { child_field_list, child_relations } =
            await table.get_child_relations();
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
                f.type === "Key" && !["_sc_files"].includes(f.reftable_name)
            );
            for (const kf of keyFields) {
              const joined_table = Table.findOne({
                name: kf.reftable_name,
              });
              if (!joined_table) continue;
              joined_table.getFields();
              joined_table.fields.forEach((jf) => {
                if (jf.name !== kf.name)
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
              {
                name: "size",
                type: "String",
                sublabel: "Match size to a header style",
                attributes: {
                  options: [1, 2, 3, 4, 5, 6].map((n) => ({
                    name: `fs-${n}`,
                    label: `Heading ${n}`,
                  })),
                },
              },
              {
                name: "rounded_pill",
                type: "Bool",
                label: "Rounded pill appearance",
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

const run = async (
  table_id,
  viewname,
  { relation, size, rounded_pill },
  state,
  extra,
  queriesObj
) => {
  const { id } = state;
  if (!id) return "need id";
  const queryRes = queriesObj?.row_query
    ? await queriesObj.row_query(id)
    : await rowQueryImpl(id, table_id, { relation });
  if (queryRes.error) throw new Error(queryRes.error);
  const { rows, mode, valField } = queryRes;
  return mode === "CHILD_TABLE"
    ? rows
        .map((row) =>
          span(
            {
              class: [
                "badge",
                bs5 ? "bg-secondary" : "badge-secondary",
                size,
                rounded_pill && "rounded-pill",
              ],
            },
            row[valField]
          )
        )
        .join("&nbsp;")
    : (rows[0]._badges || [])
        .map((b) =>
          span(
            {
              class: [
                "badge",
                bs5 ? "bg-secondary" : "badge-secondary",
                size,
                rounded_pill && "rounded-pill",
              ],
            },
            b
          )
        )
        .join("&nbsp;");
};
const runMany = async (
  table_id,
  viewname,
  { relation, size, rounded_pill },
  state,
  extra,
  queriesObj
) => {
  const queryRes = queriesObj?.many_rows_query
    ? await queriesObj.many_rows_query(state)
    : await manyRowsQueryImpl(state, table_id, viewname, { relation }, extra);
  if (queryRes.error) throw new Error(queryRes.error);
  const { rows } = queryRes;
  return rows.map((row) => ({
    html: (row._badges || [])
      .map((b) =>
        span(
          {
            class: [
              "badge",
              bs5 ? "bg-secondary" : "badge-secondary",
              size,
              rounded_pill && "rounded-pill",
            ],
          },
          b
        )
      )
      .join("&nbsp;"),
    row,
  }));
};

const rowQueryImpl = async (id, table_id, { relation }) => {
  if (!relation)
    return {
      error: `Badges view incorrectly configured. No relation chosen`,
    };
  const relSplit = relation.split(".");
  if (relSplit.length < 3)
    return {
      error: "badges view incorrectly configured. No relation chosen",
    };

  if (relSplit.length === 3) {
    const [relTableNm, relField, valField] = relSplit;

    const relTable = Table.findOne({ name: relTableNm });
    return {
      mode: "CHILD_TABLE",
      valField,
      rows: await relTable.getJoinedRows({
        where: { [relField]: id },
      }),
    };
  } else {
    const [relTableNm, relField, joinFieldNm, valField] = relSplit;
    const table = Table.findOne({ id: table_id });

    const relTable = Table.findOne({ name: relTableNm });
    await relTable.getFields();
    const joinField = relTable.fields.find((f) => f.name === joinFieldNm);

    return {
      mode: "JOIN_TABLE",
      rows: await table.getJoinedRows({
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
      }),
    };
  }
};

const manyRowsQueryImpl = async (
  state,
  table_id,
  viewname,
  { relation },
  extra
) => {
  const tbl = Table.findOne({ id: table_id });
  const fields = tbl.getFields();
  const qstate = await stateFieldsToWhere({ fields, state });
  if (!relation) {
    return {
      error: `Badges view ${viewname} incorrectly configured. No relation chosen`,
    };
  }
  const relSplit = relation.split(".");
  if (relSplit.length < 3) {
    return {
      error: "badges view incorrectly configured. No relation chosen",
    };
  }
  if (relSplit.length === 3) {
    const [relTableNm, relField, valField] = relSplit;
    return {
      rows: await tbl.getJoinedRows({
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
      }),
    };
  } else {
    const [relTableNm, relField, joinFieldNm, valField] = relSplit;

    const relTable = Table.findOne({ name: relTableNm });
    relTable.getFields();
    const joinField = relTable.fields.find((f) => f.name === joinFieldNm);

    return {
      rows: await tbl.getJoinedRows({
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
      }),
    };
  }
};

module.exports = {
  name: "Badges",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  description: "Show many-to-many relationships with badges",

  run,
  runMany,
  queries: ({
    table_id,
    req,
    configuration: { relation, size, rounded_pill },
  }) => ({
    async row_query(id) {
      return await rowQueryImpl(id, table_id, { relation });
    },
    async many_rows_query(state) {
      return await manyRowsQueryImpl(
        state,
        table_id,
        relation,
        { relation },
        { req }
      );
    },
  }),
};
