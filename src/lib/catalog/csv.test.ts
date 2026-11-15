import { describe, expect, it } from "vitest";
import { detectDelimiter, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("czyta prosty plik z przecinkami", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("obsługuje cudzysłowy, przecinki i nowe linie w polach oraz podwójny cudzysłów", () => {
    expect(parseCsv('marka,uwagi\n"Marka, A","linia ""Pro""\ndruga linia"\n')).toEqual([
      ["marka", "uwagi"],
      ["Marka, A", 'linia "Pro"\ndruga linia'],
    ]);
  });

  it("wykrywa średnik (polski Excel) i tabulator", () => {
    expect(detectDelimiter("Marka;Linia;Cena\nA;B;21,50")).toBe(";");
    expect(detectDelimiter("Marka\tLinia\nA\tB")).toBe("\t");
    expect(detectDelimiter('"Marka;x",Linia,Typ')).toBe(",");
    expect(parseCsv("Marka;Cena\nA;21,50")).toEqual([
      ["Marka", "Cena"],
      ["A", "21,50"],
    ]);
  });

  it("usuwa BOM, obsługuje CRLF i pomija puste wiersze", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n,\r\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("zachowuje puste pola", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });
});
