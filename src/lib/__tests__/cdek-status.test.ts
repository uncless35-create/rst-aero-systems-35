import { describe, expect, it } from "vitest";
import {
  describeCdekStatus,
  latestCdekStatus,
  orderStatusForCdek,
  planOrderUpdate,
} from "@/lib/cdek-status";

const ev = (code: string, dateTime: string, city: string | null = "Москва") => ({
  code,
  name: code,
  dateTime,
  city,
});

describe("статус СДЭК → статус заказа", () => {
  it("накладная оформлена, но посылку ещё не сдали — заказ остаётся в обработке", () => {
    expect(orderStatusForCdek("ACCEPTED")).toBeNull();
    expect(orderStatusForCdek("CREATED")).toBeNull();
  });

  it("путь посылки, пункт выдачи и вручение", () => {
    expect(orderStatusForCdek("RECEIVED_AT_SHIPMENT_WAREHOUSE")).toBe("SHIPPED");
    expect(orderStatusForCdek("SENT_TO_TRANSIT_CITY")).toBe("SHIPPED");
    expect(orderStatusForCdek("TAKEN_BY_COURIER")).toBe("SHIPPED");
    expect(orderStatusForCdek("ACCEPTED_AT_PICK_UP_POINT")).toBe("READY_FOR_PICKUP");
    expect(orderStatusForCdek("POSTOMAT_POSTED")).toBe("READY_FOR_PICKUP");
    expect(orderStatusForCdek("DELIVERED")).toBe("COMPLETED");
  });

  it("возврат и невручение статус не двигают, а помечаются проблемой", () => {
    for (const code of ["NOT_DELIVERED", "RETURNED_TO_SENDER_CITY_WAREHOUSE", "REMOVED", "INVALID"]) {
      expect(orderStatusForCdek(code)).toBeNull();
      expect(planOrderUpdate({ status: "SHIPPED", paymentStatus: "PENDING" }, code)).toEqual({
        status: null,
        markPaid: false,
        problem: true,
      });
    }
  });
});

describe("planOrderUpdate", () => {
  const pending = { status: "PROCESSING", paymentStatus: "PENDING" };

  it("двигает статус только вперёд", () => {
    expect(planOrderUpdate(pending, "RECEIVED_AT_SHIPMENT_WAREHOUSE").status).toBe("SHIPPED");
    expect(planOrderUpdate({ ...pending, status: "READY_FOR_PICKUP" }, "TAKEN_BY_COURIER").status).toBeNull();
    expect(planOrderUpdate({ ...pending, status: "COMPLETED" }, "ACCEPTED_AT_PICK_UP_POINT").status).toBeNull();
  });

  it("не трогает отменённый заказ", () => {
    expect(planOrderUpdate({ ...pending, status: "CANCELLED" }, "DELIVERED")).toEqual({
      status: null,
      markPaid: false,
      problem: false,
    });
  });

  it("при вручении наложенным платежом отмечает оплату, даже если заказ уже завершён вручную", () => {
    expect(planOrderUpdate(pending, "DELIVERED")).toMatchObject({ status: "COMPLETED", markPaid: true });
    expect(planOrderUpdate({ ...pending, status: "COMPLETED" }, "DELIVERED")).toMatchObject({
      status: null,
      markPaid: true,
    });
    expect(planOrderUpdate({ ...pending, paymentStatus: "SUCCEEDED" }, "DELIVERED").markPaid).toBe(false);
  });
});

describe("latestCdekStatus", () => {
  it("берёт самое позднее событие, при равном времени — первое в списке СДЭК", () => {
    const history = [
      ev("CREATED", "2026-11-07T08:26:37+0000", "Офис СДЭК"),
      ev("ACCEPTED", "2026-11-07T08:26:37+0000", "Офис СДЭК"),
      ev("DELIVERED", "2026-11-10T16:46:07+0000"),
      ev("ACCEPTED_AT_PICK_UP_POINT", "2026-11-10T07:18:36+0000"),
    ];
    expect(latestCdekStatus(history)?.code).toBe("DELIVERED");
    expect(latestCdekStatus(history.slice(0, 2))?.code).toBe("CREATED");
    expect(latestCdekStatus([])).toBeNull();
  });
});

describe("describeCdekStatus", () => {
  it("пишет статус, город и московское время", () => {
    expect(
      describeCdekStatus({
        cdekStatusName: "Принят на склад до востребования",
        cdekStatusCity: "Москва",
        cdekStatusAt: new Date("2026-11-10T07:18:36Z"),
      }),
    ).toBe("Принят на склад до востребования · Москва · 10 ноября в 10:18");
    expect(describeCdekStatus({ cdekStatusName: null, cdekStatusCity: null, cdekStatusAt: null })).toBeNull();
  });
});
