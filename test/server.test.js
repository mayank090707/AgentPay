/**
 * Integration tests for server.js
 */

const { expect } = require("chai");
const http = require("http");
const server = require("../server");

describe("Production HTTP Server (server.js)", function () {
  let port;
  let baseUrl;

  before(function (done) {
    server.listen(0, "127.0.0.1", () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  after(function (done) {
    server.close(done);
  });

  function get(path) {
    return new Promise((resolve, reject) => {
      http.get(`${baseUrl}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }).on("error", reject);
    });
  }

  it("GET /health returns 200 OK with status: ok", async function () {
    const res = await get("/health");
    expect(res.status).to.equal(200);
    expect(res.body.status).to.equal("ok");
    expect(res.body.service).to.equal("AgentPay Blockchain Service");
  });

  it("GET /api/abi returns 200 OK with canonical ABI", async function () {
    const res = await get("/api/abi");
    expect(res.status).to.equal(200);
    expect(Array.isArray(res.body.abi)).to.be.true;
    expect(res.body.abi.length).to.be.gt(10);
  });

  it("GET /api/status returns 200 OK with contract configuration", async function () {
    const res = await get("/api/status");
    expect(res.status).to.equal(200);
    expect(res.body.contractAddress).to.be.a("string");
    expect(res.body.chainId).to.be.a("number");
  });

  it("GET /not-found returns 404", async function () {
    const res = await get("/not-found");
    expect(res.status).to.equal(404);
  });
});
