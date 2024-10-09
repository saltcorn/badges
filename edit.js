const { span, button, i, a, script, div } = require("@saltcorn/markup/tags");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const db = require("@saltcorn/data/db");
const {
  jsexprToWhere,
  eval_expression,
} = require("@saltcorn/data/models/expression");
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
          const table = await Table.findOne({ id: context.table_id });
          const mytable = table;
          const fields = await table.getFields();
          const { child_field_list, child_relations } =
            await table.get_child_relations();
          var agg_field_opts = [];
          /* child_relations.forEach(({ table, key_field }) => {
            table.fields
              .filter((f) => !f.calculated || f.stored)
              .forEach((f) => {
                agg_field_opts.push({
                  name: `${table.name}.${key_field.name}.${f.name}`,
                  label: `${table.name}.${key_field.name}&#8594;${f.name}`,
                });
              });
          });*/
          for (const { table, key_field } of child_relations) {
            const keyFields = table.fields.filter(
              (f) =>
                f.type === "Key" && !["_sc_files"].includes(f.reftable_name)
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
                type: "String",
                sublabel:
                  "Only many-to-many relations (JoinTable.foreignKey&#8594;keyToTableWithLabels&#8594;badgeLabel) are supported ",

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
              {
                name: "reload_after_edit",
                type: "Bool",
                label: "Reload page after edit",
              },
              {
                name: "where",
                label: "Where",
                type: "String",
                sublabel:
                  "Restrict choices in dropdown; expression on table with labels.",
              },
              {
                name: "field_values_formula",
                label: "Row values formula",
                //class: "validate-expression",
                sublabel:
                  "Optional. A formula for field values set when creating a new join table row. For example <code>{name: manager}</code>",
                type: "String",
                //fieldview: "textarea",
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

const escapeSingleQuotes = (s) => (s ? s.replace(/'/g, "\\'") : "");

const render1 =
  ({ size, rounded_pill, viewname, id }) =>
  (b) =>
    span(
      {
        class: [
          "badge",
          bs5 ? "bg-secondary" : "badge-secondary",
          size,
          rounded_pill && "rounded-pill",
        ],
      },
      b,
      a(
        {
          onclick: `(function(that){view_post('${viewname}', 'remove', {id:'${id}', value: '${escapeSingleQuotes(
            b
          )}'}, function(){$(that).closest('span').remove()})})(this);`,
        },
        i({ class: "ms-1 fas fa-lg fa-times" })
      )
    ) + "&nbsp;";

const run = async (
  table_id,
  viewname,
  { relation, size, rounded_pill, where },
  state,
  extra,
  queriesObj
) => {
  const { id } = state;
  if (!id) return "need id";

  const { existing, possibles, error, html } = queriesObj?.edit_query
    ? await queriesObj.edit_query(id)
    : await editQueryImpl(
        id,
        table_id,
        viewname,
        {
          relation,
          size,
          rounded_pill,
          where,
        },
        extra.req
      );
  if (error) throw new Error(error);
  else if (html) return html;

  const rndid = `bs${Math.round(Math.random() * 100000)}`;
  const addbadge =
    span(
      { class: "dropdown", id: `dd${rndid}` },
      span(
        {
          class: [
            "badge",
            bs5 ? "bg-secondary" : "badge-secondary",
            "dropdown-toggle",
            size,
            rounded_pill && "rounded-pill",
          ],
          "data-bs-toggle": "dropdown",
          id: rndid,
          "aria-haspopup": "true",
          "aria-expanded": "false",
        },
        i({ class: "fas fa-lg fa-plus" })
      ),
      div(
        { class: "dropdown-menu", "aria-labelledby": rndid },
        possibles
          .map((p) =>
            a(
              {
                class: "dropdown-item",
                onclick: `set_add_badge_${rndid}('${escapeSingleQuotes(p)}')`,
              },
              p
            )
          )
          .join("")
      )
    ) +
    script(`function set_add_badge_${rndid}(value) {
    view_post('${viewname}', 'add', {id:'${id}', value: value}, function(resp){
      $('span#dd${rndid}').before(resp.new_badge)
    })
  }
  `);
  return existing + addbadge;
};

const remove = async (
  table_id,
  viewname,
  { relation },
  { id, value },
  extra,
  queriesObj
) => {
  const queryRes = queriesObj?.remove_route_query
    ? await queriesObj.remove_route_query(id, value)
    : await removeRouteImpl(id, value, { relation }, extra.req);
  return { json: queryRes };
};
const add = async (
  table_id,
  viewname,
  { relation, size, rounded_pill, field_values_formula },
  { id, value },
  { req },
  queriesObj
) => {
  const queryRes = queriesObj?.add_route_query
    ? await queriesObj.add_route_query(id, value)
    : await addRouteImpl(
        table_id,
        { id, value },
        { relation, size, rounded_pill, field_values_formula },
        req
      );
  if (queryRes.error) return { json: { error: queryRes.error } };
  else
    return {
      json: {
        success: "ok",
        reload_page: queryRes.reload_page,
        new_badge: render1({ viewname, size, rounded_pill, id })(value),
      },
    };
};

const editQueryImpl = async (
  id,
  table_id,
  viewname,
  { relation, size, rounded_pill, where },
  req
) => {
  if (!relation) {
    return {
      error: `EditBadges view ${viewname} incorrectly configured. No relation chosen`,
    };
  }
  const relSplit = relation.split(".");
  if (relSplit.length < 4) {
    return {
      error: `EditBadges view ${viewname} incorrectly configured. No relation chosen`,
    };
  }
  const [relTableNm, relField, joinFieldNm, valField] = relSplit;
  const table = Table.findOne({ id: table_id });

  const relTable = Table.findOne({ name: relTableNm });
  await relTable.getFields();
  const joinField = relTable.fields.find((f) => f.name === joinFieldNm);
  const joinedTable = Table.findOne({ name: joinField.reftable_name });

  const rows = await table.getJoinedRows({
    where: { id },
    forPublic: !req.user || req.user.role_id === 100, // TODO in mobile set user null for public
    forUser: req.user,
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

  if (!rows[0]) return { html: "No row selected" };

  const existing = (rows[0]._badges || [])
    .map(render1({ size, rounded_pill, viewname, id }))
    .join("");

  let ddWhere = {};
  if (where)
    ddWhere = jsexprToWhere(
      where,
      { ...rows[0], user: req.user },
      joinedTable.fields
    );
  const possibles = await joinedTable.distinctValues(valField, ddWhere);
  possibles.sort((a, b) =>
    (a?.toLowerCase?.() || a) > (b?.toLowerCase?.() || b) ? 1 : -1
  );

  return { existing, possibles };
};

const removeRouteImpl = async (
  id,
  value,
  { relation, reload_after_edit },
  req
) => {
  const relSplit = relation.split(".");
  const [joinTableNm, relField, joinFieldNm, valField] = relSplit;
  const joinTable = Table.findOne({ name: joinTableNm });
  const joinField = joinTable.fields.find((f) => f.name === joinFieldNm);
  const labelTbl = Table.findOne({ name: joinField.reftable_name });
  const ids = (await labelTbl.getRows({ [valField]: value })).map((r) => r.id);
  if (!db.isSQLite)
    await joinTable.deleteRows(
      { [relField]: id, [joinFieldNm]: { in: ids } },
      req?.user
    );
  else
    await joinTable.deleteRows(
      {
        [relField]: id,
        or: ids.map((id) => ({ [joinFieldNm]: id })),
      },
      req?.user
    );
  return { success: "ok", reload_page: reload_after_edit === true };
};

const addRouteImpl = async (
  table_id,
  { id, value },
  { relation, field_values_formula, reload_after_edit },
  req
) => {
  const table = Table.findOne({ id: table_id });
  const rows = await table.getJoinedRows({
    where: { id },
    forPublic: !req.user || req.user.role_id === 100, // TODO in mobile set user null for public
    forUser: req.user,
  });
  if (!rows[0]) return { error: "Row not found" };
  let extra = {};
  if (field_values_formula) {
    extra = eval_expression(field_values_formula, rows[0], req.user);
  }

  const relSplit = relation.split(".");
  const [joinTableNm, relField, joinFieldNm, valField] = relSplit;
  const joinTable = Table.findOne({ name: joinTableNm });
  await joinTable.getFields();
  const joinField = joinTable.fields.find((f) => f.name === joinFieldNm);
  const joinedTable = Table.findOne({ name: joinField.reftable_name });
  const joinedRow = await joinedTable.getRow({ [valField]: value });
  await joinTable.insertRow({
    [relField]: id,
    [joinFieldNm]: joinedRow.id,
    ...extra,
  });
  return { success: "ok", reload_page: reload_after_edit === true };
};
module.exports = {
  name: "EditBadges",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  description: "Edit many-to-many relationships with badges",
  run,
  routes: { remove, add },
  queries: ({
    table_id,
    exttable_name,
    name, // viewname
    configuration: {
      relation,
      size,
      rounded_pill,
      where,
      field_values_formula,
      reload_after_edit,
    },
    req,
    res,
  }) => ({
    async edit_query(id) {
      return await editQueryImpl(
        id,
        table_id,
        name,
        {
          relation,
          size,
          rounded_pill,
          where,
        },
        req
      );
    },
    remove_route_query(id, value) {
      return removeRouteImpl(id, value, { relation, reload_after_edit }, req);
    },
    add_route_query(id, value) {
      return addRouteImpl(
        table_id,
        {
          id,
          value,
        },
        { relation, field_values_formula, reload_after_edit },
        req
      );
    },
  }),
};
