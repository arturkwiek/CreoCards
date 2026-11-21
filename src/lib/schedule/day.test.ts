import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOf,
  dayRange,
  endTime,
  findConflicts,
  formatDay,
  isDay,
  layoutDay,
  minuteOfDay,
  startsAt,
  timeOf,
  timeOptions,
  todayWarsaw,
  type Slot,
} from "./day";

const slot = (id: string, local: string, duration: number, status: Slot["status"] = "umowiona"): Slot => ({
  id,
  starts_at: startsAt(local.slice(0, 10), local.slice(11, 16))!,
  duration_min: duration,
  status,
});

describe("dzień i godzina w Warszawie", () => {
  it("początek terminu zimą i latem", () => {
    expect(startsAt("2026-12-01", "10:00")).toBe("2026-12-01T09:00:00.000Z");
    expect(startsAt("2026-07-01", "10:00")).toBe("2026-07-01T08:00:00.000Z");
    expect(startsAt("2026-12-01", "24:00")).toBeNull();
    expect(startsAt("2026-02-30", "10:00")).toBeNull();
  });

  it("zakres dnia – także w dniach zmiany czasu (23 h i 25 h)", () => {
    expect(dayRange("2026-12-01")).toEqual({ from: "2026-11-30T23:00:00.000Z", to: "2026-12-01T23:00:00.000Z" });
    const spring = dayRange("2026-03-29");
    expect((Date.parse(spring.to) - Date.parse(spring.from)) / 3_600_000).toBe(23);
    const autumn = dayRange("2026-10-25");
    expect((Date.parse(autumn.to) - Date.parse(autumn.from)) / 3_600_000).toBe(25);
  });

  it("termin późnym wieczorem należy do swojego dnia w Warszawie (nie UTC)", () => {
    const iso = startsAt("2026-12-01", "23:30")!;
    expect(iso.slice(0, 10)).toBe("2026-12-01");
    expect(dayOf(startsAt("2026-07-02", "00:30")!)).toBe("2026-07-02");
    expect(timeOf(iso)).toBe("23:30");
    expect(minuteOfDay(startsAt("2026-07-02", "09:15")!)).toBe(555);
  });

  it("dni: dodawanie, dzisiaj, walidacja, etykieta", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(todayWarsaw(new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-22");
    expect(isDay("2026-11-21")).toBe(true);
    expect(isDay("2026-11-31")).toBe(false);
    expect(isDay("21.11.2026")).toBe(false);
    expect(formatDay("2026-11-21")).toBe("sobota, 21 listopada");
  });

  it("koniec terminu i siatka co 15 min od 7:00 do 21:00", () => {
    expect(endTime(startsAt("2026-12-01", "10:00")!, 90)).toBe("11:30");
    const options = timeOptions();
    expect(options[0]).toBe("07:00");
    expect(options.at(-1)).toBe("20:45");
    expect(options).toHaveLength(56);
  });
});

describe("kolizje", () => {
  const day = [
    slot("a", "2026-12-01T10:00", 60),
    slot("b", "2026-12-01T12:00", 30),
    slot("c", "2026-12-01T13:00", 60, "odwolana"),
  ];

  it("nakładające się terminy tej samej osoby", () => {
    expect(findConflicts({ starts_at: startsAt("2026-12-01", "10:30")!, duration_min: 60 }, day).map((c) => c.id)).toEqual(["a"]);
    expect(findConflicts({ starts_at: startsAt("2026-12-01", "09:00")!, duration_min: 240 }, day).map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("termin stykający się końcem z początkiem – bez kolizji", () => {
    expect(findConflicts({ starts_at: startsAt("2026-12-01", "11:00")!, duration_min: 60 }, day)).toEqual([]);
  });

  it("odwołany termin nie koliduje; zmieniany termin nie koliduje sam ze sobą", () => {
    expect(findConflicts({ starts_at: startsAt("2026-12-01", "13:00")!, duration_min: 60 }, day)).toEqual([]);
    expect(findConflicts({ id: "a", starts_at: startsAt("2026-12-01", "10:15")!, duration_min: 60 }, day)).toEqual([]);
  });
});

describe("układ dnia", () => {
  it("bloki od 7:00; nakładające się obok siebie", () => {
    const { startMin, endMin, blocks } = layoutDay([
      slot("a", "2026-12-01T10:00", 60),
      slot("b", "2026-12-01T10:30", 60),
      slot("c", "2026-12-01T14:00", 30),
    ]);
    expect([startMin, endMin]).toEqual([420, 1260]);
    expect(blocks.map((b) => [b.item.id, b.top, b.height, b.col, b.cols])).toEqual([
      ["a", 180, 60, 0, 2],
      ["b", 210, 60, 1, 2],
      ["c", 420, 30, 0, 1],
    ]);
  });

  it("termin przed 7:00 lub po 21:00 poszerza siatkę", () => {
    const { startMin, endMin } = layoutDay([slot("a", "2026-12-01T06:30", 30), slot("b", "2026-12-01T20:30", 90)]);
    expect([startMin, endMin]).toEqual([360, 1320]);
  });

  it("wolne miejsce w kolumnie jest używane ponownie", () => {
    const { blocks } = layoutDay([
      slot("a", "2026-12-01T10:00", 120),
      slot("b", "2026-12-01T10:00", 30),
      slot("c", "2026-12-01T10:30", 30),
    ]);
    expect(blocks.map((b) => [b.item.id, b.col, b.cols])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
    ]);
  });
});
