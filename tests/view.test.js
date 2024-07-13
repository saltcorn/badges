const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const { mockReqRes } = require("@saltcorn/data/tests/mocks");
const { afterAll, beforeAll, describe, it, expect } = require("@jest/globals");

getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
getState().registerPlugin("@saltcorn/badges", require(".."));

afterAll(require("@saltcorn/data/db").close);
beforeAll(async () => {
  await getState().refresh(true);
});

describe("badges show", () => {
  it("show album with embeds", async () => {
    const view = View.findOne({ name: "show_album" });
    expect(view).toBeDefined();
    const result = await view.run({ id: 1 }, mockReqRes);
    expect(result).toEqual(
      `<h1>album A</h1><div class="d-inline" data-sc-embed-viewname="show_one_to_many" data-sc-view-source="/view/show_one_to_many?id=1">` +
        `<span class="badge bg-secondary fs-4 rounded-pill">track one on album A</span>&nbsp;` +
        `<span class="badge bg-secondary fs-4 rounded-pill">track two on album A</span></div><br /><br />` +
        `<div class="d-inline" data-sc-embed-viewname="show_many_to_many" data-sc-view-source="/view/show_many_to_many?id=1">` +
        `<span class="badge bg-secondary fs-3 rounded-pill">artist A</span>&nbsp;<span class="badge bg-secondary fs-3 rounded-pill">artist B</span></div>`
    );
  });
  it("show one to many", async () => {
    const view = View.findOne({ name: "show_one_to_many" });
    expect(view).toBeDefined();
    const result = await view.run({ id: 1 }, mockReqRes);
    expect(result).toEqual(
      `<span class="badge bg-secondary fs-4 rounded-pill">track one on album A</span>&nbsp;` +
        `<span class="badge bg-secondary fs-4 rounded-pill">track two on album A</span>`
    );
  });

  it("show many to many", async () => {
    const view = View.findOne({ name: "show_many_to_many" });
    expect(view).toBeDefined();
    const result = await view.run({ id: 1 }, mockReqRes);
    expect(result).toEqual(
      `<span class="badge bg-secondary fs-3 rounded-pill">artist A</span>&nbsp;<span class="badge bg-secondary fs-3 rounded-pill">artist B</span>`
    );
  });
});

describe("badges edit", () => {
  it("edit album", async () => {
    const view = View.findOne({ name: "edit_album_badges" });
    expect(view).toBeDefined();
    const result = await view.run({ id: 1 }, mockReqRes);
    expect(result).toContain(
      `<a onclick=\"(function(that){view_post('edit_album_badges', 'remove', {id:'1', value: 'album A'}, ` +
        `function(){$(that).closest('span').remove()})})(this);\"><i class=\"ms-1 fas fa-lg fa-times\"></i></a>`
    );
  });

  it("add route", async () => {
    const view = View.findOne({ name: "edit_album_badges" });
    expect(view).toBeDefined();
    const body = { id: 1, value: "album A" };
    await view.runRoute(
      "add",
      body,
      mockReqRes.res,
      { req: mockReqRes.req },
      false
    );
    const result = mockReqRes.getStored();
    expect(result?.json).toBeDefined();
    expect(result?.json.success).toEqual("ok");
    expect(result?.json.new_badge).toEqual(
      `<span class="badge bg-secondary fs-5">album A<a onclick="(function(that){view_post('edit_album_badges', ` +
        `'remove', {id:'1', value: 'album A'}, function(){$(that).closest('span').remove()})})(this);"><i class="ms-1 fas fa-lg fa-times"></i></a></span>&nbsp;`
    );
  });

  it("remove route", async () => {
    const view = View.findOne({ name: "edit_album_badges" });
    expect(view).toBeDefined();
    const body = { id: 1, value: "album A" };
    await view.runRoute(
      "remove",
      body,
      mockReqRes.res,
      { req: mockReqRes.req },
      false
    );
    const result = mockReqRes.getStored();
    expect(result?.json).toBeDefined();
    expect(result?.json.success).toEqual("ok");
  });
});

describe("badges like", () => {
  it("like album", async () => {
    const view = View.findOne({ name: "like_album" });
    expect(view).toBeDefined();
    const result = await view.run({ id: 1 }, mockReqRes);
    expect(result).toEqual(
      `<span onclick=\"$(this).hasClass('text-danger')?view_post('like_album', 'remove', {id:'1'}, ` +
        `()=>{$(this).removeClass('text-danger').html('<i class=\\'far fa-lg fa-heart\\'></i>')} ):view_post('like_album', 'like', {id:'1'}, ` +
        `()=>{$(this).addClass('text-danger').html('<i class=\\'fas fa-lg fa-heart\\'></i>')} )\"><i class=\"far fa-lg fa-heart\"></i></span>`
    );
  });

  it("show album with like subview", async () => {
    const view = View.findOne({ name: "show_album_with_like" });
    expect(view).toBeDefined();
    const result = await view.run({ id: 1 }, mockReqRes);
    expect(result).toEqual(
      `<h1>album A</h1><div class=\"d-inline\" data-sc-embed-viewname=\"show_one_to_many\" data-sc-view-source=\"/view/show_one_to_many?id=1\"></div><br /><br />` +
        `<div class=\"d-inline\" data-sc-embed-viewname=\"show_many_to_many\" data-sc-view-source=\"/view/show_many_to_many?id=1\">` +
        `<span class=\"badge bg-secondary fs-3 rounded-pill\">artist A</span>&nbsp;<span class=\"badge bg-secondary fs-3 rounded-pill\">artist B</span></div>` +
        `<div class=\"d-inline\" data-sc-embed-viewname=\"like_album\" data-sc-view-source=\"/view/like_album?id=1\">` +
        `<span onclick=\"$(this).hasClass('text-danger')?view_post('like_album', 'remove', {id:'1'}, ` +
        `()=>{$(this).removeClass('text-danger').html('<i class=\\'far fa-lg fa-heart\\'></i>')} ):view_post('like_album', 'like', {id:'1'}, ` +
        `()=>{$(this).addClass('text-danger').html('<i class=\\'fas fa-lg fa-heart\\'></i>')} )\"><i class=\"far fa-lg fa-heart\"></i></span></div>`
    );
  });

  it("remove route", async () => {
    const view = View.findOne({ name: "like_album" });
    expect(view).toBeDefined();
    const body = { id: 1 };
    await view.runRoute(
      "remove",
      body,
      mockReqRes.res,
      { req: mockReqRes.req },
      false
    );
    const result = mockReqRes.getStored();
    expect(result?.json).toBeDefined();
    expect(result?.json.success).toEqual("ok");
  });

  it("like route", async () => {
    // const view = View.findOne({ name: "like_album" });
    // expect(view).toBeDefined();
    // const body = { id: 2 };
    // await view.runRoute(
    //   "like",
    //   body,
    //   mockReqRes.res,
    //   { req: mockReqRes.req },
    //   false
    // );
    // const result = mockReqRes.getStored();
    // expect(result?.json).toBeDefined();
    // expect(result?.json.success).toEqual("ok");
  });
});
