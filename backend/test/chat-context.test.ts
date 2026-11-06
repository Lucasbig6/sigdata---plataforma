import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessage } from "ai";
import { resolveMentions, withUserContext } from "../src/chat-context";

test("menção a tabela vira texto simples", () => {
  assert.equal(resolveMentions("total de :tabela[Vendas]{name=vendas_2024} por mês"), 'total de a tabela "vendas_2024" por mês');
  assert.equal(resolveMentions("veja :tabela[pedidos]"), 'veja a tabela "pedidos"');
  assert.equal(resolveMentions("sem menção"), "sem menção");
});

test("citação entra antes da pergunta e o original não muda", () => {
  const original: UIMessage = {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "explique :tabela[a]" }],
    metadata: { custom: { quote: { text: "linha 1\nlinha 2", messageId: "m0" } } },
  };
  const [prepared] = withUserContext([original]);
  const text = prepared!.parts[0]!.type === "text" ? prepared!.parts[0]!.text : "";
  assert.equal(text, 'Trecho citado da conversa:\n> linha 1\n> linha 2\n\nexplique a tabela "a"');
  assert.equal(original.parts[0]!.type === "text" ? original.parts[0]!.text : "", "explique :tabela[a]");
});

test("mensagens do assistente passam intactas", () => {
  const message: UIMessage = { id: "a1", role: "assistant", parts: [{ type: "text", text: ":tabela[x]" }] };
  assert.deepEqual(withUserContext([message]), [message]);
});
