const { span, button, i, a, script, div } = require("@saltcorn/markup/tags");
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

          // table with like: parent user with user, no other required
          let table_opts = [];
          // user field in like table.
          let user_field_opts = {};
          // string for session in like table
          let session_field_opts = {};
          for (const { table, key_field } of child_relations) {
            const relnm = `${table.name}.${key_field.name}`;
            table_opts.push(relnm);
            user_field_opts[relnm] = [""];
            session_field_opts[relnm] = [""];
            await table.getFields();
            table.fields.forEach((f) => {
              if (f.type.name === "String")
                session_field_opts[relnm].push(f.name);
              if (f.reftable_name === "users")
                user_field_opts[relnm].push(f.name);
            });
          }

          return new Form({
            fields: [
              {
                name: "relation",
                label: "Relation",
                type: "String",
                sublabel: "The table recording likes",

                required: true,
                attributes: {
                  options: table_opts,
                },
              },
              {
                name: "user_field",
                label: "User Field",
                type: "String",
                sublabel: "For likes from logged-in users",
                required: false,
                attributes: {
                  calcOptions: ["relation", user_field_opts],
                },
              },
              {
                name: "session_field",
                label: "Session Field",
                type: "String",
                sublabel: "For likes from public users",
                required: false,
                attributes: {
                  calcOptions: ["relation", session_field_opts],
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

const run = async (
  table_id,
  viewname,
  { relation, user_field, session_field },
  state,
  extra
) => {
  const { id } = state;
  if (!id) return "need id";

  const [reltable, relfield] = relation.split(".");
  const relTable = await Table.findOne({ name: reltable });

  // logged in?
  const user_id = extra.req.user ? extra.req.user.id : null;
  const where = { [relfield]: id };

  if (user_id && user_field) where[user_field] = user_id;
  else if (session_field) where[session_field] = extra.req.sessionID;
  else {
    return "";
  }
  const likerow = await relTable.getRow(where);

  if (likerow) {
    return span(
      {
        style: "color:#e25",
        onclick: `view_post('${viewname}', 'remove', {id:'${id}'})`,
      },
      i({ class: "fas fa-heart" })
    );
  } else {
    return span(
      {        
        onclick: `view_post('${viewname}', 'like', {id:'${id}'})`,
      },
      i({ class: "far fa-heart" })
    );
  }
};

const remove = async (table_id, viewname, {relation, user_field, session_field }, { id }, extra) => {
  const [reltable, relfield] = relation.split(".");
  const relTable = await Table.findOne({ name: reltable });

  // logged in?
  const user_id = extra.req.user ? extra.req.user.id : null;
  const where = { [relfield]: +id };

  if (user_id && user_field) where[user_field] = user_id;
  else if (session_field) where[session_field] = extra.req.sessionID;
  await relTable.deleteRows(where)

  return { json: { success: "ok" } };
};
const like = async (table_id, viewname, { relation, user_field, session_field}, { id }, extra) => {
  const [reltable, relfield] = relation.split(".");
  const relTable = await Table.findOne({ name: reltable });

  // logged in?
  const user_id = extra.req.user ? extra.req.user.id : null;
  const where = { [relfield]: +id };

  if (user_id && user_field) where[user_field] = user_id;
  else if (session_field) where[session_field] = extra.req.sessionID;

  await relTable.insertRow(where, user_id)

  return { json: { success: "ok" } };
};

module.exports = {
  name: "LikeBadge",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
  routes: { remove, like },
};
