import { describe, expect, it } from "vitest";
import { findMatchingClient } from "./client-matching";

const clients = [
  { id: "client-1", name: "Anna Beispiel", email: "anna@example.com", phone: "+49 30 123" },
  { id: "client-2", name: "Musterbau GmbH", email: "info@musterbau.example", phone: "+49 30 456" }
];

describe("findMatchingClient", () => {
  it("matches by normalized email first", () => {
    expect(findMatchingClient(clients, { name: "Someone", email: " ANNA@EXAMPLE.COM " })).toEqual({
      match: clients[0],
      reason: "email"
    });
  });

  it("matches by normalized phone before name", () => {
    expect(findMatchingClient(clients, { name: "Anna Beispiel", phone: "+4930456" })).toEqual({
      match: clients[1],
      reason: "phone"
    });
  });

  it("falls back to normalized exact name", () => {
    expect(findMatchingClient(clients, { name: "musterbau gmbh" })).toEqual({
      match: clients[1],
      reason: "name"
    });
  });

  it("returns no match when no identity field matches", () => {
    expect(findMatchingClient(clients, { name: "New Client", email: "new@example.com" })).toEqual({
      match: null,
      reason: "none"
    });
  });
});
