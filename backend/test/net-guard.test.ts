import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPrivateAddress, resolveSafeHost } from "../src/net-guard";

test("reconhece endereços de rede interna", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
});

test("aceita endereços públicos", () => {
  for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("em produção recusa host interno, salvo liberação explícita", async () => {
  const antes = { env: process.env.NODE_ENV, allow: process.env.SIGDATA_ALLOW_PRIVATE_HOSTS };
  try {
    delete process.env.SIGDATA_ALLOW_PRIVATE_HOSTS;
    process.env.NODE_ENV = "production";
    await assert.rejects(resolveSafeHost("127.0.0.1"), /rede interna/);
    await assert.rejects(resolveSafeHost("169.254.169.254"), /rede interna/);
    assert.equal(await resolveSafeHost("8.8.8.8"), "8.8.8.8");
    process.env.SIGDATA_ALLOW_PRIVATE_HOSTS = "true";
    assert.equal(await resolveSafeHost("127.0.0.1"), "127.0.0.1");
  } finally {
    if (antes.env === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = antes.env;
    if (antes.allow === undefined) delete process.env.SIGDATA_ALLOW_PRIVATE_HOSTS;
    else process.env.SIGDATA_ALLOW_PRIVATE_HOSTS = antes.allow;
  }
});
