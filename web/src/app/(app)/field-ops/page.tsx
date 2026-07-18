"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { listProfiles } from "@/lib/api/live";
import {
  checkInLodging,
  checkOutLodging,
  createLodgingProperty,
  listActiveCarExpenses,
  listLodgingProperties,
  listOpenLodgingOccupancies,
  updateExpenseTolls,
} from "@/lib/api/remodel";
import { lodgingDailyShare } from "@/lib/payroll-math";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DemoUser, LodgingKind, LodgingOccupancy, LodgingProperty } from "@/lib/types";

type Tab = "cars" | "airbnb" | "hotels";

export default function FieldOpsPage() {
  const [tab, setTab] = useState<Tab>("cars");
  const [cars, setCars] = useState<Awaited<ReturnType<typeof listActiveCarExpenses>>>([]);
  const [properties, setProperties] = useState<LodgingProperty[]>([]);
  const [occupancies, setOccupancies] = useState<LodgingOccupancy[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [error, setError] = useState("");
  const [tollDraft, setTollDraft] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<LodgingKind>("airbnb");
  const [propName, setPropName] = useState("");
  const [dailyTotal, setDailyTotal] = useState("");
  const [roomCount, setRoomCount] = useState("5");
  const [roomRate, setRoomRate] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [userId, setUserId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [occupants, setOccupants] = useState("1");

  async function load() {
    setError("");
    try {
      const [carRows, props, occ, profiles] = await Promise.all([
        listActiveCarExpenses(),
        listLodgingProperties(),
        listOpenLodgingOccupancies(),
        listProfiles(),
      ]);
      setCars(carRows);
      setProperties(props);
      setOccupancies(occ);
      setPeople(profiles);
      if (!propertyId && props[0]) setPropertyId(props[0].id);
      if (!userId && profiles[0]) setUserId(profiles[0].id);
      const tolls: Record<string, string> = {};
      for (const car of carRows) {
        tolls[car.id as string] = String(car.tolls_amount ?? 0);
      }
      setTollDraft(tolls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load field ops.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const names = Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const filteredProps = properties.filter((p) =>
    tab === "airbnb" ? p.kind === "airbnb" : tab === "hotels" ? p.kind === "hotel" : true,
  );
  const filteredOcc = occupancies.filter((o) => {
    const prop = properties.find((p) => p.id === o.propertyId);
    if (tab === "airbnb") return prop?.kind === "airbnb";
    if (tab === "hotels") return prop?.kind === "hotel";
    return false;
  });

  async function createProperty() {
    try {
      await createLodgingProperty({
        kind,
        name: propName,
        dailyTotal: kind === "airbnb" ? parseFloat(dailyTotal) || 0 : null,
        roomCount: kind === "airbnb" ? parseInt(roomCount, 10) || 1 : null,
        roomRate: kind === "hotel" ? parseFloat(roomRate) || 0 : null,
      });
      setPropName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create property.");
    }
  }

  async function doCheckIn() {
    const prop = properties.find((p) => p.id === propertyId);
    if (!prop) return;
    const dailyAmount = lodgingDailyShare({
      kind: prop.kind,
      dailyTotal: prop.dailyTotal,
      roomCount: prop.roomCount,
      roomRate: prop.roomRate,
      occupantsInRoom: parseInt(occupants, 10) || 1,
    });
    try {
      await checkInLodging({
        propertyId,
        userId,
        roomNumber,
        occupantsInRoom: parseInt(occupants, 10) || 1,
        checkInAt: new Date().toISOString(),
        dailyAmount,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check in.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations"
        title="Field Ops"
        description="Active cars, Airbnbs, and hotels. Map comes later; this view is the live occupancy board."
      />
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["cars", "Active cars"],
            ["airbnb", "Airbnbs"],
            ["hotels", "Hotels"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "primary" : "ghost"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "cars" ? (
        <Card>
          <CardBody className="p-0">
            <DataTable>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Start</Th>
                  <Th align="right">Base</Th>
                  <Th align="right">Tolls</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 bg-white/50">
                {cars.map((car) => (
                  <tr key={car.id as string}>
                    <Td>{names[car.user_id as string] ?? "Unknown"}</Td>
                    <Td>{formatDate(String(car.expense_date))}</Td>
                    <Td align="right">{formatCurrency(Number(car.amount))}</Td>
                    <Td align="right">
                      <Input
                        className="ml-auto w-24"
                        value={tollDraft[car.id as string] ?? "0"}
                        onChange={(e) =>
                          setTollDraft((prev) => ({ ...prev, [car.id as string]: e.target.value }))
                        }
                      />
                    </Td>
                    <Td>
                      <Button
                        size="sm"
                        onClick={() =>
                          void updateExpenseTolls(
                            car.id as string,
                            parseFloat(tollDraft[car.id as string] || "0") || 0,
                          ).then(load)
                        }
                      >
                        Update tolls
                      </Button>
                    </Td>
                  </tr>
                ))}
                {cars.length === 0 ? (
                  <tr>
                    <Td colSpan={5}>
                      <p className="py-6 text-center text-sm text-ink/50">No active car rentals.</p>
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </DataTable>
          </CardBody>
        </Card>
      ) : (
        <>
          <Card>
            <CardBody className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Add property</p>
                <Select value={kind} onChange={(e) => setKind(e.target.value as LodgingKind)}>
                  <option value="airbnb">Airbnb</option>
                  <option value="hotel">Hotel</option>
                </Select>
                <Input placeholder="Name" value={propName} onChange={(e) => setPropName(e.target.value)} />
                {kind === "airbnb" ? (
                  <>
                    <Input placeholder="Daily total" value={dailyTotal} onChange={(e) => setDailyTotal(e.target.value)} />
                    <Input placeholder="Room count" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} />
                  </>
                ) : (
                  <Input placeholder="Room rate" value={roomRate} onChange={(e) => setRoomRate(e.target.value)} />
                )}
                <Button onClick={() => void createProperty()}>Create property</Button>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Check in</p>
                <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  {filteredProps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Room #" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
                <div className="space-y-2">
                  <Label>Occupants in room</Label>
                  <Input value={occupants} onChange={(e) => setOccupants(e.target.value)} />
                </div>
                <Button onClick={() => void doCheckIn()}>Check in</Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Property</Th>
                    <Th>User</Th>
                    <Th>Room</Th>
                    <Th>Occupants</Th>
                    <Th>Check-in</Th>
                    <Th align="right">Daily share</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {filteredOcc.map((occ) => {
                    const prop = properties.find((p) => p.id === occ.propertyId);
                    return (
                      <tr key={occ.id}>
                        <Td>{prop?.name ?? "—"}</Td>
                        <Td>{names[occ.userId] ?? "Unknown"}</Td>
                        <Td>{occ.roomNumber}</Td>
                        <Td>{occ.occupantsInRoom}</Td>
                        <Td>{formatDate(occ.checkInAt.slice(0, 10))}</Td>
                        <Td align="right">
                          {occ.dailyAmount != null ? formatCurrency(occ.dailyAmount) : "—"}
                        </Td>
                        <Td>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                void checkOutLodging({ occupancyId: occ.id }).then(load)
                              }
                            >
                              Check out now
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);
                                void checkOutLodging({
                                  occupancyId: occ.id,
                                  backdated: true,
                                  checkOutDate: yesterday.toISOString().slice(0, 10),
                                }).then(load);
                              }}
                            >
                              Backdate checkout
                            </Button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
