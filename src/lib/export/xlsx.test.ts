import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildCsvZip, buildXlsx, columnName, escapeXml, sheetNames, toCsv } from "./xlsx";

// Wyłącznie dane testowe.
const rows = [
  ["id", "full_name", "allergies", "price", "active"],
  ["c1", "Łucja Żak", 'PPD, "lateks"\nskóra', 21.5, true],
  ["c2", "=HYPERLINK(1)", "", null, false],
];

describe("pomocnicze", () => {
  it("nazwy kolumn", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
  });
  it("XML: znaki specjalne i niedozwolone", () => {
    expect(escapeXml('a<b>&"c"\u0001')).toBe("a&lt;b&gt;&amp;&quot;c&quot;");
  });
  it("nazwy arkuszy: długość, znaki, unikalność", () => {
    expect(sheetNames(["klientki", "a/b", "x".repeat(40), "Klientki", ""])).toEqual([
      "klientki",
      "a b",
      "x".repeat(31),
      "Klientki 2",
      "Arkusz",
    ]);
  });
});

describe("buildXlsx", () => {
  const files = unzipSync(buildXlsx([{ name: "klientki", rows }, { name: "pusty", rows: [] }]));

  it("zawiera wymagane części OOXML", () => {
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
    ]);
    expect(strFromU8(files["xl/workbook.xml"])).toContain('<sheet name="klientki" sheetId="1" r:id="rId1"/>');
  });

  it("komórki: polskie znaki, nowe linie, liczby, logiczne, puste; formuła jako tekst", () => {
    const xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(xml).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">Łucja Żak</t></is></c>');
    expect(xml).toContain("PPD, &quot;lateks&quot;\nskóra");
    expect(xml).toContain('<c r="D2"><v>21.5</v></c>');
    expect(xml).toContain('<c r="E2" t="b"><v>1</v></c>');
    expect(xml).toContain('<c r="B3" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(1)</t></is></c>');
    expect(xml).not.toContain('r="C3"');
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr">');
  });
});

describe("CSV", () => {
  it("średnik, BOM, CRLF, cudzysłowy, przecinek dziesiętny, ochrona przed formułą", () => {
    expect(toCsv(rows)).toBe(
      "﻿id;full_name;allergies;price;active\r\n" +
        'c1;Łucja Żak;"PPD, ""lateks""\nskóra";21,5;true\r\n' +
        "c2;'=HYPERLINK(1);;;false\r\n",
    );
  });
  it("ZIP z plikiem na arkusz", () => {
    const files = unzipSync(buildCsvZip([{ name: "klientki", rows }, { name: "wizyty", rows: [["id"]] }]));
    expect(Object.keys(files).sort()).toEqual(["klientki.csv", "wizyty.csv"]);
    // UTF-8 z BOM (EF BB BF) – polski Excel poprawnie odczyta ogonki.
    expect([...files["wizyty.csv"].slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(strFromU8(files["wizyty.csv"].slice(3))).toBe("id\r\n");
  });
});
