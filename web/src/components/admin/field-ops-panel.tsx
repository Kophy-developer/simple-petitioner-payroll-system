"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DataTable, Td, Th } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { listProfiles } from "@/lib/api/live";
import {
  approveHousingCheckout,
  assignRentalCar,
  bulkAssignHousing,
  createLodgingProperty,
  listLodgingProperties,
  listOpenLodgingOccupancies,
  listRentalCarAssignments,
  mergeLodgingProperties,
  returnRentalCar,
} from "@/lib/api/remodel";
import { formatCurrency, formatDate } from "@/lib/format";
import { rentalCarGuideTotal } from "@/lib/roster-import";
import type {
  DemoUser,
  HousingShareKind,
  LodgingKind,
  LodgingOccupancy,
  LodgingProperty,
  RentalCarAssignment,
} from "@/lib/types";

type Tab = "cars" | "housing";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FieldOpsPanel() {
  const [tab, setTab] = useState<Tab>("housing");
  const [cars, setCars] = useState<RentalCarAssignment[]>([]);
  const [properties, setProperties] = useState<LodgingProperty[]>([]);
  const [occupancies, setOccupancies] = useState<LodgingOccupancy[]>([]);
  const [people, setPeople] = useState<DemoUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<LodgingKind>("airbnb");
  const [propName, setPropName] = useState("");
  const [fullRate, setFullRate] = useState("");
  const [halfRate, setHalfRate] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [checkIn, setCheckIn] = useState(todayIso());
  const [shares, setShares] = useState<Record<string, HousingShareKind>>({});
  const [keepId, setKeepId] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [carUserId, setCarUserId] = useState("");
  const [pickupAt, setPickupAt] = useState(todayIso());
  const [agreementNumber, setAgreementNumber] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [oneWayFee, setOneWayFee] = useState("");

  const fieldPeople = useMemo(
    () => people.filter((p) => ["petitioner", "team_lead", "canvasser"].includes(p.role)),
    [people],
  );

  async function load() {
    setError("");
    try {
      const [carRows, props, occ, profiles] = await Promise.all([
        listRentalCarAssignments(true),
        listLodgingProperties(),
        listOpenLodgingOccupancies(),
        listProfiles(),
      ]);
      setCars(carRows);
      setProperties(props);
      setOccupancies(occ);
      setPeople(profiles);
      if (!propertyId && props[0]) setPropertyId(props[0].id);
      if (!keepId && props[0]) setKeepId(props[0].id);
      if (!carUserId && profiles[0]) setCarUserId(profiles[0].id);
      const selected = props.find((p) => p.id === (propertyId || props[0]?.id));
      if (selected) {
        if (selected.fullRate != null) setFullRate(String(selected.fullRate));
        else if (selected.roomRate != null) setFullRate(String(selected.roomRate));
        if (selected.halfRate != null) setHalfRate(String(selected.halfRate));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load field operations.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const names = Object.fromEntries(people.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const selectedProp = properties.find((p) => p.id === propertyId);

  async function createProperty() {
    setMessage("");
    try {
      await createLodgingProperty({
        kind,
        name: propName,
        dailyTotal: kind === "airbnb" ? parseFloat(fullRate) || 0 : null,
        roomCount: 1,
        roomRate: parseFloat(fullRate) || 0,
      });
      if (fullRate || halfRate) {
        const props = await listLodgingProperties();
        const created = props.find((p) => p.name.toLowerCase() === propName.trim().toLowerCase());
        if (created) {
          const { updateHousingRates } = await import("@/lib/api/remodel");
          await updateHousingRates(
            created.id,
            parseFloat(fullRate) || 0,
            parseFloat(halfRate) || 0,
          );
        }
      }
      setPropName("");
      setMessage("Property saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create property.");
    }
  }

  async function doBulkAssign() {
    if (!propertyId) return;
    setMessage("");
    setError("");
    try {
      const assignments = fieldPeople
        .map((p) => ({
          userId: p.id,
          shareKind: shares[p.id] ?? ("skip" as HousingShareKind),
        }))
        .filter((a) => a.shareKind !== "skip");
      const count = await bulkAssignHousing({
        propertyId,
        checkIn,
        fullRate: parseFloat(fullRate) || 0,
        halfRate: parseFloat(halfRate) || 0,
        assignments,
      });
      setMessage(`Assigned ${count} stay(s). Nightly accrual runs at midnight Mountain Time.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign housing.");
    }
  }

  async function doMerge() {
    if (!keepId || !mergeId || keepId === mergeId) {
      setError("Pick two different properties to merge.");
      return;
    }
    setMessage("");
    try {
      await mergeLodgingProperties(keepId, mergeId);
      setMergeId("");
      setMessage("Properties merged.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not merge properties.");
    }
  }

  async function doAssignCar() {
    setMessage("");
    setError("");
    try {
      await assignRentalCar({
        userId: carUserId,
        pickupAt,
        agreementNumber: agreementNumber || undefined,
        pickupLocation: pickupLocation || undefined,
        dropoffLocation: dropoffLocation || undefined,
        oneWayFee: oneWayFee === "" ? 0 : parseFloat(oneWayFee) || 0,
      });
      setAgreementNumber("");
      setPickupLocation("");
      setDropoffLocation("");
      setOneWayFee("");
      setMessage("Rental car assigned. Monthly accrual $1,146 while out; true-up on return.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not assign car.");
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{message}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["housing", "Housing"],
            ["cars", "Rental cars"],
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
        <>
          <Card>
            <CardBody className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Assign rental car</p>
              <p className="text-sm text-ink/55">
                Guide: $50/day (1–6), $309/week, $1,146/month. Accrues monthly while out; true-up on
                return. One-way fee $150 (admin).
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Petitioner</Label>
                  <Select value={carUserId} onChange={(e) => setCarUserId(e.target.value)}>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pick-up date</Label>
                  <Input type="date" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Agreement # (optional)</Label>
                  <Input value={agreementNumber} onChange={(e) => setAgreementNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>One-way fee (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="150"
                    value={oneWayFee}
                    onChange={(e) => setOneWayFee(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pick-up location (optional)</Label>
                  <Input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Drop-off location (optional)</Label>
                  <Input value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} />
                </div>
              </div>
              <Button onClick={() => void doAssignCar()} disabled={!carUserId}>
                Assign car
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Pick-up</Th>
                    <Th>Agreement</Th>
                    <Th align="right">One-way</Th>
                    <Th align="right">Est. guide</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {cars.map((car) => {
                    const days = Math.max(
                      0,
                      Math.floor(
                        (Date.now() - new Date(car.pickupAt).getTime()) / (1000 * 60 * 60 * 24),
                      ),
                    );
                    return (
                      <tr key={car.id}>
                        <Td>{names[car.userId] ?? "Unknown"}</Td>
                        <Td>{formatDate(car.pickupAt)}</Td>
                        <Td>{car.agreementNumber || "—"}</Td>
                        <Td align="right">{formatCurrency(car.oneWayFee)}</Td>
                        <Td align="right">{formatCurrency(rentalCarGuideTotal(days))}</Td>
                        <Td>
                          <Button
                            size="sm"
                            onClick={() =>
                              void returnRentalCar(car.id).then(load).catch((e) =>
                                setError(e instanceof Error ? e.message : "Return failed"),
                              )
                            }
                          >
                            Return &amp; true-up
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                  {cars.length === 0 ? (
                    <tr>
                      <Td colSpan={6}>
                        <p className="py-6 text-center text-sm text-ink/50">No active rentals.</p>
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardBody className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Property listing</p>
                <Select value={kind} onChange={(e) => setKind(e.target.value as LodgingKind)}>
                  <option value="airbnb">Airbnb</option>
                  <option value="hotel">Hotel</option>
                </Select>
                <Input
                  placeholder="Listing name"
                  value={propName}
                  onChange={(e) => setPropName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Full rate"
                    value={fullRate}
                    onChange={(e) => setFullRate(e.target.value)}
                  />
                  <Input
                    placeholder="Half rate"
                    value={halfRate}
                    onChange={(e) => setHalfRate(e.target.value)}
                  />
                </div>
                <Button onClick={() => void createProperty()} disabled={!propName.trim()}>
                  Save property
                </Button>
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Merge duplicates</p>
                <Select value={keepId} onChange={(e) => setKeepId(e.target.value)}>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
                <Select value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
                  <option value="">Select duplicate</option>
                  {properties
                    .filter((p) => p.id !== keepId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </Select>
                <Button variant="ghost" onClick={() => void doMerge()} disabled={!mergeId}>
                  Merge properties
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Bulk assign stays</p>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Property</Label>
                  <Select
                    value={propertyId}
                    onChange={(e) => {
                      setPropertyId(e.target.value);
                      const p = properties.find((x) => x.id === e.target.value);
                      if (p?.fullRate != null) setFullRate(String(p.fullRate));
                      if (p?.halfRate != null) setHalfRate(String(p.halfRate));
                    }}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Check-in</Label>
                  <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Full / Half</Label>
                  <div className="flex gap-2">
                    <Input value={fullRate} onChange={(e) => setFullRate(e.target.value)} />
                    <Input value={halfRate} onChange={(e) => setHalfRate(e.target.value)} />
                  </div>
                </div>
              </div>
              {selectedProp ? (
                <p className="text-xs text-ink/55">Assigning to {selectedProp.name}</p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2">
                {fieldPeople.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-ink">
                      {p.firstName} {p.lastName}
                    </span>
                    <Select
                      className="w-28"
                      value={shares[p.id] ?? "skip"}
                      onChange={(e) =>
                        setShares((prev) => ({
                          ...prev,
                          [p.id]: e.target.value as HousingShareKind,
                        }))
                      }
                    >
                      <option value="skip">Skip</option>
                      <option value="full">Full</option>
                      <option value="half">Half</option>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={() => void doBulkAssign()} disabled={!propertyId}>
                Assign selected
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              <DataTable>
                <thead>
                  <tr>
                    <Th>Property</Th>
                    <Th>User</Th>
                    <Th>Share</Th>
                    <Th>Check-in</Th>
                    <Th>Checkout</Th>
                    <Th align="right">Daily</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/8 bg-white/50">
                  {occupancies.map((occ) => {
                    const prop = properties.find((p) => p.id === occ.propertyId);
                    return (
                      <tr key={occ.id}>
                        <Td>{prop?.name ?? "—"}</Td>
                        <Td>{names[occ.userId] ?? "Unknown"}</Td>
                        <Td>
                          <Badge>{occ.shareKind ?? "full"}</Badge>
                        </Td>
                        <Td>{formatDate(occ.checkInAt.slice(0, 10))}</Td>
                        <Td>
                          {occ.checkoutRequestedAt ? (
                            <Badge tone="warning">Requested</Badge>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td align="right">
                          {occ.dailyAmount != null ? formatCurrency(occ.dailyAmount) : "—"}
                        </Td>
                        <Td>
                          {occ.checkoutRequestedAt ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                void approveHousingCheckout(occ.id)
                                  .then(load)
                                  .catch((e) =>
                                    setError(e instanceof Error ? e.message : "Approve failed"),
                                  )
                              }
                            >
                              Approve checkout
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void approveHousingCheckout(occ.id)
                                  .then(load)
                                  .catch((e) =>
                                    setError(e instanceof Error ? e.message : "Checkout failed"),
                                  )
                              }
                            >
                              Force checkout
                            </Button>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                  {occupancies.length === 0 ? (
                    <tr>
                      <Td colSpan={7}>
                        <p className="py-6 text-center text-sm text-ink/50">No open stays.</p>
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </DataTable>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
